
import { z } from 'zod'
export const agentStateSchema = z.enum(['idle','planning','working','reviewing','waiting_approval','paused','blocked','error','done'])
export type AgentState = z.infer<typeof agentStateSchema>
export const runStatusSchema = z.enum(['draft','queued','running','delivering','awaiting_approval','paused','completed','cancelled','failed','unknown'])
export type RunStatus = z.infer<typeof runStatusSchema>
const avatarSchema = z.object({ version: z.string(), dataUrl: z.string().max(900000).regex(/^data:image\/(png|webp);base64,/), frameWidth: z.number().int().min(16).max(256), frameHeight: z.number().int().min(16).max(256) })
export const agentSchema = z.object({ id:z.string(),workspaceId:z.string(),name:z.string(),role:z.string(),color:z.string(),state:agentStateSchema,skills:z.array(z.string()),model:z.string(),policy:z.enum(['supervised','draft_only']),avatar:avatarSchema.optional() })
export type Agent = z.infer<typeof agentSchema>
export const workspaceSchema = z.object({id:z.string(),name:z.string(),description:z.string(),packId:z.string(),icon:z.string(),monthlyBudget:z.number().nonnegative(),dailyBudget:z.number().nonnegative(),perRunBudget:z.number().nonnegative(),concurrency:z.number().int().nonnegative(),entitlements:z.object({planName:z.string(),availableCredits:z.number(),maxAgents:z.number(),maxWorktrees:z.number(),subscriptionStatus:z.string()}).optional()})
export type Workspace = z.infer<typeof workspaceSchema>
export const runSchema = z.object({id:z.string(),workspaceId:z.string(),title:z.string(),brief:z.string(),agentId:z.string(),workflowId:z.string(),status:runStatusSchema,progress:z.number().min(0).max(100),estimatedCredits:z.number().nonnegative(),requiresApproval:z.boolean(),approved:z.boolean(),createdAt:z.string(),updatedAt:z.string(),log:z.array(z.string()),taskId:z.string().optional(),taskSessionId:z.string().optional(),backendStatus:z.string().optional(),branchName:z.string().nullable().optional(),deliveryStatus:z.string().nullable().optional(),commitSha:z.string().nullable().optional(),remoteSha:z.string().nullable().optional(),hermesStatus:z.string().nullable().optional()})
export type Run = z.infer<typeof runSchema>
export const workflowSchema = z.object({id:z.string(),workspaceId:z.string(),name:z.string(),description:z.string(),steps:z.array(z.string()),requiresApproval:z.boolean(),estimatedCredits:z.number(),trigger:z.enum(['manual','daily','weekly']),enabled:z.boolean()})
export type Workflow = z.infer<typeof workflowSchema>
export const snapshotSchema = z.object({
 version:z.literal(1),workspaces:z.array(workspaceSchema),agents:z.array(agentSchema),runs:z.array(runSchema),workflows:z.array(workflowSchema),
 artifacts:z.array(z.object({id:z.string(),workspaceId:z.string(),runId:z.string(),name:z.string(),kind:z.enum(['document','storyboard','code']),content:z.string(),createdAt:z.string()})),
 knowledge:z.array(z.object({id:z.string(),workspaceId:z.string(),name:z.string(),content:z.string(),category:z.enum(['knowledge','skill']),createdAt:z.string()})),
 connections:z.array(z.object({id:z.string(),workspaceId:z.string(),toolId:z.string(),status:z.enum(['demo','connected','disconnected'])})),
 ledger:z.array(z.object({id:z.string(),workspaceId:z.string(),runId:z.string(),category:z.enum(['ModelCall','ToolCall','MediaGeneration','SandboxExecution','AgentRun']),credits:z.number().nonnegative(),createdAt:z.string()}))
})
export type Snapshot = z.infer<typeof snapshotSchema>
export type Artifact = Snapshot['artifacts'][number]
export type Command =
 | {type:'create-workspace';name:string;packId:string}
 | {type:'create-agent';workspaceId:string;name:string;role:string;skills:string[]}
 | {type:'update-agent';workspaceId:string;agentId:string;model?:string;policy?:Agent['policy'];avatar?:Agent['avatar']}
 | {type:'create-run';workspaceId:string;title:string;brief:string;workflowId:string;agentId:string}
 | {type:'run-action';workspaceId:string;runId:string;action:'pause'|'resume'|'cancel'|'approve'|'reject'|'queue'|'start'}
 | {type:'save-knowledge';workspaceId:string;name:string;content:string;category:'knowledge'|'skill'}
 | {type:'configure-connection';workspaceId:string;toolId:string;enabled:boolean}
 | {type:'update-workflow';workspaceId:string;workflowId:string;trigger:Workflow['trigger'];enabled:boolean}
 | {type:'update-budget';workspaceId:string;monthlyBudget:number;dailyBudget:number;perRunBudget:number;concurrency:number}
 | {type:'tick'}
export const pages = ['overview','agents','runs','workflows','office','templates','content','artifacts','approvals','knowledge','connections','usage','settings'] as const
export type Page = typeof pages[number]
export const uid = (prefix:string) => prefix+'-'+crypto.randomUUID()
export const iso = () => new Date().toISOString()
