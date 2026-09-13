import { describe, expect, it } from 'vitest'
import { installPack, reduceCommand, reserved, seed } from '../src/core/demo'
import type { Snapshot } from '../src/core/domain'

function empty(): Snapshot {
  return {version:1,workspaces:[],agents:[],runs:[],workflows:[],artifacts:[],knowledge:[],connections:[],ledger:[]}
}
function fixture() {
  const data=empty(), workspace=installPack(data,'Test studio','research')
  return {data,workspace,agent:data.agents[0],flow:data.workflows[0]}
}
function start() {
  const f=fixture()
  return {...f,data:reduceCommand(f.data,{type:'create-run',workspaceId:f.workspace.id,title:'A test mission',brief:'Explore and prepare a draft.',workflowId:f.flow.id,agentId:f.agent.id})}
}
describe('Workspace and execution boundaries',()=>{
  it('installs independent packs without sharing IDs or mutable data',()=>{
    const data=empty(), one=installPack(data,'One','content'), two=installPack(data,'Two','content')
    const first=data.agents.filter(a=>a.workspaceId===one.id), second=data.agents.filter(a=>a.workspaceId===two.id)
    expect(first).toHaveLength(5);expect(second).toHaveLength(5)
    expect(new Set(data.agents.map(a=>a.id)).size).toBe(10)
    first[0].skills.push('Private skill')
    expect(second.flatMap(a=>a.skills)).not.toContain('Private skill')
    expect(data.workflows.filter(w=>w.workspaceId===one.id)).toHaveLength(4)
  })
  it('rejects cross-workspace agents and run actions without mutating input',()=>{
    const f=start(), other=installPack(f.data,'Other','software'), before=structuredClone(f.data)
    expect(()=>reduceCommand(f.data,{type:'create-run',workspaceId:other.id,agentId:f.agent.id,workflowId:f.data.workflows.find(w=>w.workspaceId===other.id)!.id,title:'Wrong scope',brief:'Must fail'})).toThrow('agent in this workspace')
    expect(()=>reduceCommand(f.data,{type:'run-action',workspaceId:other.id,runId:f.data.runs[0].id,action:'cancel'})).toThrow('Run is not in this workspace')
    expect(f.data).toEqual(before)
  })
  it('reserves credits, enforces concurrency, and releases a cancelled reservation',()=>{
    let {data,workspace,agent,flow}=start()
    const cmd={type:'create-run' as const,workspaceId:workspace.id,agentId:agent.id,workflowId:flow.id,title:'Another task',brief:'Prepare a draft'}
    data=reduceCommand(data,cmd)
    expect(reserved(data,workspace.id)).toBe(flow.estimatedCredits*2)
    expect(()=>reduceCommand(data,cmd)).toThrow('Concurrency limit')
    data=reduceCommand(data,{type:'run-action',workspaceId:workspace.id,runId:data.runs[0].id,action:'cancel'})
    expect(reserved(data,workspace.id)).toBe(flow.estimatedCredits)
    expect(reduceCommand(data,cmd).runs.filter(r=>r.status==='running')).toHaveLength(2)
    expect(data.ledger).toHaveLength(0)
  })
  it('does not double-charge a completed run and waits for approval when required',()=>{
    let {data,workspace}=start()
    const id=data.runs[0].id
    data.runs[0].requiresApproval=true
    for(let i=0;i<40;i++) data=reduceCommand(data,{type:'tick'})
    expect(data.runs[0].status).toBe('awaiting_approval')
    expect(data.ledger).toHaveLength(0)
    expect(data.artifacts).toHaveLength(0)
    data=reduceCommand(data,{type:'run-action',workspaceId:workspace.id,runId:id,action:'approve'})
    for(let i=0;i<40;i++) data=reduceCommand(data,{type:'tick'})
    expect(data.runs[0].status).toBe('completed')
    expect(data.ledger.filter(l=>l.runId===id)).toHaveLength(1)
    expect(data.artifacts.filter(a=>a.runId===id)).toHaveLength(1)
    expect(reserved(data,workspace.id)).toBe(0)
    expect(data.artifacts[0].content).toContain('not AI-generated')
    expect(()=>reduceCommand(data,{type:'run-action',workspaceId:workspace.id,runId:id,action:'approve'})).toThrow()
  })
  it('pauses active runs when a reduced budget cannot cover reservations',()=>{
    const f=start()
    const next=reduceCommand(f.data,{type:'update-budget',workspaceId:f.workspace.id,monthlyBudget:100,dailyBudget:10,perRunBudget:5,concurrency:1})
    expect(next.runs[0].status).toBe('paused')
    expect(()=>reduceCommand(next,{type:'run-action',workspaceId:f.workspace.id,runId:next.runs[0].id,action:'resume'})).toThrow('per-run budget')
    expect(f.data.runs[0].status).toBe('running')
  })
  it('enforces reservations against the daily limit before spending',()=>{
    const f=fixture()
    f.workspace.dailyBudget=f.flow.estimatedCredits
    f.workspace.perRunBudget=f.flow.estimatedCredits
    const cmd={type:'create-run' as const,workspaceId:f.workspace.id,agentId:f.agent.id,workflowId:f.flow.id,title:'Budget test',brief:'Draft'}
    const data=reduceCommand(f.data,cmd)
    expect(()=>reduceCommand(data,cmd)).toThrow('Daily budget reached')
  })
  it('keeps seeded records within their workspace',()=>{
    const data=seed()
    for(const run of data.runs)expect(data.agents.find(a=>a.id===run.agentId)?.workspaceId).toBe(run.workspaceId)
    for(const artifact of data.artifacts)expect(data.runs.find(r=>r.id===artifact.runId)?.workspaceId).toBe(artifact.workspaceId)
  })
})
