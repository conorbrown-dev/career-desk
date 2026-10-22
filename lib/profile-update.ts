import {createHash} from 'node:crypto';
import {z} from 'zod';
const text=z.string().max(12000);
export const profileChanges=z.object({
 name:z.string().trim().min(1).max(150).optional(),email:z.string().email().optional(),phone:z.string().max(200).optional(),location:z.string().max(1000).optional(),citizenship:z.string().max(1000).optional(),portfolio:z.string().max(2000).optional(),linkedin:z.string().max(2000).optional(),
 criteria:z.object({minimumBase:z.number().nonnegative().max(10000000).optional(),roles:z.string().trim().min(1).max(3000).optional(),remote:z.string().trim().min(1).max(1000).optional(),degree:z.string().max(1000).optional(),targetBase:z.string().max(1000).optional()}).strict().optional(),
 experience:z.object({summary:text.optional(),technologies:text.optional(),accomplishments:text.optional(),employmentHistory:text.optional(),exclusions:text.optional()}).strict().optional(),rules:z.array(z.string().max(1000)).max(30).optional()
}).strict().refine(value=>Object.keys(value).length>0,'Provide at least one profile change');
export const profileUpdateSchema=z.object({expectedRevision:z.string().regex(/^[a-f0-9]{64}$/),changes:profileChanges}).strict();
function ordered(value:any):any{if(Array.isArray(value))return value.map(ordered);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])]));return value}
export function profileRevision(profile:any){const {gettingStarted,...editable}=profile;return createHash('sha256').update(JSON.stringify(ordered(editable))).digest('hex')}
