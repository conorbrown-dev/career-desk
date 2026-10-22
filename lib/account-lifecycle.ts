import type {Database} from './repository';
export const lifecycleMigration=`
CREATE TABLE IF NOT EXISTS career_deleted_owners(owner_id TEXT PRIMARY KEY);
CREATE OR REPLACE FUNCTION career_limit_accounts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('career-desk:account-capacity'));
 IF (SELECT count(*) FROM "user") >= 50 THEN
  RAISE EXCEPTION 'Public beta capacity reached. Please try again later.';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS career_limit_signups ON "user";
CREATE TRIGGER career_limit_signups BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION career_limit_accounts();
CREATE OR REPLACE FUNCTION career_remove_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(OLD.id));
 INSERT INTO career_deleted_owners(owner_id) VALUES(OLD.id) ON CONFLICT DO NOTHING;
 DELETE FROM career_documents WHERE owner_id=OLD.id;
 DELETE FROM career_jobs WHERE owner_id=OLD.id;
 DELETE FROM career_profiles WHERE owner_id=OLD.id;
 DELETE FROM career_runs WHERE owner_id=OLD.id;
 DELETE FROM career_plugin_usage WHERE owner_id=OLD.id OR owner_id='import:'||OLD.id;
 RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS career_delete_workspace ON "user";
CREATE TRIGGER career_delete_workspace BEFORE DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION career_remove_workspace();`;
/** Blocks stale requests from recreating a deleted workspace after waiting on its owner lock. */
export async function assertWorkspaceActive(db:Database,owner:string){
 const r=await db.query('SELECT owner_id FROM career_deleted_owners WHERE owner_id=$1',[owner]);
 if(r.rows.length)throw Error('This account has been deleted. Sign in with an active account.');
}
