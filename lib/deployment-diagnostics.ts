import type {Pool} from 'pg';

// Hosted setup failures are operator diagnostics, not workspace activity: they have no owner,
// never appear in the dashboard or list_discovery_activity, and are kept for 30 days.
export const diagnosticsTableSql=`CREATE TABLE IF NOT EXISTS deployment_diagnostics(id TEXT PRIMARY KEY,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),stage TEXT NOT NULL,detail TEXT NOT NULL)`;

// Earlier deployments wrote failures into the operator's activity feed. Move exactly those entries
// (matched by status and the generated summary prefix) in one statement so none are lost or duplicated.
export const moveSetupRunsSql=`WITH moved AS (
 DELETE FROM career_runs
 WHERE payload->>'status'='Setup failed' AND payload->>'summary' LIKE 'ChatGPT connection deployment failed during %'
 RETURNING owner_id,id,created_at,payload
)
INSERT INTO deployment_diagnostics(id,created_at,stage,detail)
SELECT 'run:'||owner_id||':'||id,created_at,'legacy activity entry',payload->>'summary' FROM moved
ON CONFLICT(id) DO NOTHING`;

export async function recordDiagnostic(db:Pool,id:string,stage:string,detail:string){
 await db.query(diagnosticsTableSql);
 await db.query('INSERT INTO deployment_diagnostics(id,stage,detail) VALUES($1,$2,$3)',[id,stage.slice(0,200),detail.slice(0,2500)]);
 await db.query("DELETE FROM deployment_diagnostics WHERE created_at<NOW()-INTERVAL '30 days'");
}
