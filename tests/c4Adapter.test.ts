import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { c4Request, executeC4Command, hasAccessToken, loadC4Snapshot, mapTaskStatus, setAccessToken } from '../src/core/c4Adapter'
const ws={id:'workspace-1',name:'C4 workspace',description:null,created_at:'2026-09-13T00:00:00Z',updated_at:'2026-09-13T00:00:00Z'}
const agent={id:'agent-1',workspace_id:ws.id,name:'Engineer',role:'software',status:'active',model_source:'mesthi_ai',model_id:null}
const task={id:'task-1',workspace_id:ws.id,agent_id:agent.id,title:'Deliver change',instructions:'A backend task',status:'delivering',branch_name:'task/example',result_summary:null,error_message:null,created_at:ws.created_at,updated_at:ws.updated_at}
const entitlement={plan:{name:'Free',limits:{max_agents:5,max_parallel_tasks:2,max_active_worktrees:2,monthly_llm_credits:1000}},subscription:{status:'active'},credits:{available:850}}
function mockSnapshot(taskOverride={}) {
  vi.stubGlobal('fetch',vi.fn(async(input:URL)=>{
    const path=input.pathname
    const payload=path.endsWith('/workspaces')?[ws]:path.endsWith('/agents')?[agent]:path.endsWith('/tasks')?[{...task,...taskOverride}]:entitlement
    return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}})
  }))
}
beforeEach(()=>{vi.stubGlobal('location',{origin:'https://app.example'});setAccessToken('test-token')})
afterEach(()=>{setAccessToken('');vi.unstubAllGlobals();vi.unstubAllEnvs()})
describe('C4 API boundary',()=>{
  it('keeps delivery distinct from completion and unknown statuses unknown',()=>{
    expect(mapTaskStatus('delivering')).toBe('delivering')
    for(const status of ['future-state','toString','__proto__'])expect(mapTaskStatus(status)).toBe('unknown')
    expect(mapTaskStatus('completed')).toBe('completed')
  })
  it('loads only backend data and does not fabricate session or delivery evidence',async()=>{
    mockSnapshot()
    const data=await loadC4Snapshot()
    expect(data.runs[0].status).toBe('delivering')
    expect(data.runs[0].taskSessionId).toBeUndefined()
    expect(data.runs[0].commitSha).toBeUndefined()
    expect(data.runs[0].progress).toBe(0)
    expect(data.workspaces[0].entitlements?.availableCredits).toBe(850)
    expect(data.artifacts).toEqual([])
    expect(data.workflows).toEqual([])
  })
  it('rejects workspace mismatches from the API',async()=>{
    mockSnapshot({workspace_id:'another-workspace'})
    await expect(loadC4Snapshot()).rejects.toThrow('workspace mismatch')
  })
  it('expires an unauthorized session without falling back to demo data',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:401})))
    await expect(loadC4Snapshot()).rejects.toThrow('expired')
    expect(hasAccessToken()).toBe(false)
  })
  it('rejects an HTML gateway response and cross-origin token transmission',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('<html/>',{headers:{'content-type':'text/html'}})))
    await expect(c4Request('/v1/workspaces')).rejects.toThrow('gateway returned HTML')
    vi.stubEnv('VITE_API_BASE_URL','https://other.example')
    await expect(c4Request('/v1/workspaces')).rejects.toThrow('same-origin')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('creates a Task without implicitly queueing or starting it',async()=>{
    const request=vi.fn(async()=>new Response('{}',{headers:{'content-type':'application/json'}}))
    vi.stubGlobal('fetch',request)
    await executeC4Command({type:'create-run',workspaceId:ws.id,agentId:agent.id,workflowId:'',title:'Draft change',brief:'Implement the task'})
    expect(request).toHaveBeenCalledTimes(1)
    const [url,init]=request.mock.calls[0] as unknown as [URL,RequestInit]
    expect(url.pathname).toBe('/api/v1/workspaces/workspace-1/tasks')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({agent_id:'agent-1',title:'Draft change',instructions:'Implement the task',priority:'normal'})
  })
  it('refuses unsupported pack installation before any request',async()=>{
    vi.stubGlobal('fetch',vi.fn())
    await expect(executeC4Command({type:'create-workspace',name:'Studio',packId:'content'})).rejects.toThrow('backend template endpoint')
    expect(fetch).not.toHaveBeenCalled()
  })
})
