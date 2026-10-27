import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePath,parseSegments,tabPath,tabs,withJob} from '../app/dashboard/routes';

test('every workspace tab and section has a URL that parses back to itself',()=>{
 for(const t of tabs){
  for(const base of ['/dashboard','/demo']){
   const path=tabPath(base,t.name);
   assert.deepEqual(parsePath(path,base),{tab:t.name});
  }
 }
 assert.equal(tabPath('/dashboard','Overview'),'/dashboard');
 assert.equal(tabPath('/dashboard','Search profile','sources'),'/dashboard/profile/sources');
 assert.deepEqual(parsePath('/dashboard/profile/sources','/dashboard'),{tab:'Search profile',section:'sources'});
});

test('unknown workspace paths are rejected so the page can 404',()=>{
 assert.deepEqual(parseSegments([]),{tab:'Overview'});
 assert.deepEqual(parseSegments(undefined),{tab:'Overview'});
 assert.equal(parseSegments(['nope']),null);
 assert.equal(parseSegments(['opportunities','sources']),null,'sections belong to one tab');
 assert.equal(parseSegments(['profile','sources','extra']),null);
 assert.equal(parseSegments(['profile','unknown']),null);
});

test('the opportunity panel is addressed by a query parameter on the current tab',()=>{
 assert.equal(withJob('/dashboard/opportunities','abc-123'),'/dashboard/opportunities?job=abc-123');
 assert.equal(withJob('/dashboard','new'),'/dashboard?job=new');
 assert.equal(withJob('/dashboard',null),'/dashboard');
 assert.equal(withJob('/dashboard','a b&c'),'/dashboard?job=a%20b%26c');
});
