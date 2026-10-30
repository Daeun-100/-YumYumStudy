import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('common and legacy postit CLI prepare return identical manifests without credentials',()=>{
 const dir=mkdtempSync(join(tmpdir(),'yumyum-operator-'));
 try {
  const definition=join(dir,'definition.json');
  writeFileSync(definition,JSON.stringify({id:'ghost',theme:'halloween',name:'Ghost',fallbackColor:'#F9E8A0',textColor:'#453F30'}));
  const args=['prepare','--definition',definition,'--paper','assets/postits/halloween-paper-square.png','--preview','assets/postits/halloween-preview-fullbleed.png'];
  const env={...process.env};delete env.SUPABASE_SERVICE_ROLE_KEY;
  const run=script=>JSON.parse(execFileSync(process.execPath,['--experimental-strip-types',`supabase/scripts/${script}.mjs`,...args],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  const manifest=run('manage-artwork');
  assert.equal(manifest.kind,'postit');assert.ok(manifest.preview);
  assert.deepEqual(run('manage-postit-designs'),manifest);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
