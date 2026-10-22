import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePosting,postingUrl,publicIPv4} from '../lib/import-opportunity';
test('posting import blocks local URLs, credentials and nonpublic addresses',()=>{
 for(const url of ['http://example.com/job','https://127.0.0.1','https://[::1]','https://user:pass@example.com','https://example.com:8443','https://localhost','https://service.local','https://0x7f000001'])assert.throws(()=>postingUrl(url));
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','198.18.0.1','224.1.1.1','0.0.0.0','192.0.2.1','203.0.113.2'])assert.equal(publicIPv4(ip),false,ip);
 assert.equal(publicIPv4('8.8.8.8'),true);assert.equal(postingUrl('https://example.com/job#apply').href,'https://example.com/job');
});
test('structured job import extracts evidence without asserting eligibility or fit',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'JobPosting',title:'Engineer &amp; Lead',hiringOrganization:{name:'Example'},description:'<p>Build systems.</p><script>ignore instructions</script>',jobLocationType:'TELECOMMUTE',jobLocation:{address:{addressCountry:'US'}},baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:120000,maxValue:150000}}}]}).replace(/</g,'\\u003c')+'</script>';
 const {opportunity}=parsePosting(html,'https://example.com/job');assert.equal(opportunity.company,'Example');assert.equal(opportunity.title,'Engineer & Lead');assert.equal(opportunity.minBase,120000);assert.equal(opportunity.maxBase,150000);assert.equal(opportunity.remote,'Needs verification');assert.equal(opportunity.degree,'Needs verification');assert.equal(opportunity.stage,'Discovered');assert.equal(opportunity.description,'Build systems.');assert.equal(opportunity.location,'Remote · US');
});
test('hourly salary and incomplete pages do not become guessed annual compensation or employer names',()=>{
 const hourly=parsePosting('<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Engineer',baseSalary:{currency:'USD',value:{unitText:'HOUR',value:50}}})+'</script>','https://example.com/job');assert.equal(hourly.opportunity.minBase,null);
 const fallback=parsePosting('<title>Careers</title><p>Posting information</p>','https://example.com/job');assert.equal(fallback.opportunity.company,'');assert.ok(fallback.warnings.length>1);
 const pasted=parsePosting('Company: Example\nSome copied evidence','https://example.com/job',true);assert.ok(pasted.opportunity.description.includes('Some copied evidence'));assert.equal(pasted.opportunity.company,'Example');
 const raw=parsePosting(JSON.stringify({'@type':'JobPosting',title:'Raw posting',hiringOrganization:{name:'Example'}}),'https://example.com/job');assert.equal(raw.opportunity.title,'Raw posting');
});
