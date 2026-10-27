import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScoreboard } from '../vendor/noname/overrides/grail-scoreboard.js';

class Node {
  constructor(tag) {
    this.tagName=tag; this.children=[]; this.attributes={};
    this.dataset={}; this.textContent=''; this.hidden=false;
    this.handlers={}; this.className=''; this.type='';
  }
  append(...children) { this.children.push(...children); for(const child of children) child.parentElement=this; }
  setAttribute(name,value) {this.attributes[name]=String(value);}
  getAttribute(name) {return this.attributes[name]??null;}
  addEventListener(name,cb) {this.handlers[name]=cb;}
  descendants() {return this.children.flatMap(node=>[node,...node.descendants()]);}
  click() {this.handlers.click?.();}
}
test('compact team summary is progressive disclosure, not a second scoreboard or changed match data', () => {
  const former=globalThis.document;
  const htmlClass = {names:new Set(),add(value){this.names.add(value)}};
  globalThis.document={
    createElement:tag=>new Node(tag),
    createElementNS:(ns,tag)=>new Node(tag),
    documentElement:{classList:htmlClass},
  };
  try {
    const parent=new Node('root');
    const render=createScoreboard(parent);
    const board=parent.children[0];
    const btn=board.descendants().find(node=>node.className==='grail-score-toggle');
    assert.equal(board.id,'grail-scoreboard');
    assert.equal(board.dataset.expanded,'false');
    assert.equal(btn.getAttribute('aria-expanded'),'false');
    assert.equal(btn.getAttribute('aria-controls'),'grail-score-teams');
    assert.equal(btn.type,'button');
    const teams=[
      {id:'red',name:'紅隊',morale:15,grails:1,goal:5,gems:2,crystals:3},
      {id:'blue',name:'藍隊',morale:12,grails:2,goal:5,gems:1,crystals:0},
    ];
    const before=JSON.stringify(teams);
    render(teams,{side:true,turn:8,over:false});
    assert.equal(board.hidden,false);
    assert.equal(JSON.stringify(teams),before,'read-only rendering must not modify engine scores');
    const stats=board.descendants().filter(node=>node.className==='grail-score-metric');
    assert.equal(stats.length,8,'all eight live public score metrics remain in DOM');
    assert.equal(stats.find(node=>node.dataset.kind==='morale').children.at(-1).textContent,'15');
    btn.click();
    assert.equal(board.dataset.expanded,'true');
    assert.equal(btn.textContent,'收合');
    assert.equal(btn.getAttribute('aria-expanded'),'true');
    render([{...teams[0],gems:3},teams[1]],{side:true,turn:9,over:false});
    assert.equal(stats.find(node=>node.dataset.kind==='gems').children.at(-1).textContent,'3');
    btn.click();
    assert.equal(board.dataset.expanded,'false');
    assert.equal(btn.getAttribute('aria-expanded'),'false');
  } finally {globalThis.document=former;}
});

test('phone defaults to concise action/morale/cup and restores gem/crystal stats on expand',async()=>{
 const css=await readFile(new URL('../vendor/noname/overrides/grail.css',import.meta.url),'utf8');
 assert.match(css, /#grail-scoreboard \.grail-score-toggle \{ display: none; \}/);
 assert.match(css, /@media \(max-width: 600px\) and \(orientation: portrait\)[\s\S]*?#grail-scoreboard \.grail-score-toggle \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/);
 assert.match(css, /#grail-scoreboard:not\(\[data-expanded="true"\]\) \.grail-score-metric:is\(\[data-kind="gems"\],\[data-kind="crystals"\]\)[\s\S]*?display: none/);
 assert.match(css, /#grail-scoreboard\[data-expanded="true"\] \.grail-score-stats/);
 assert.match(css, /#grail-scoreboard \.grail-score-heading > #grail-phase-hint[\s\S]*?white-space: nowrap/);
});
test('mobile shorter history control keeps unread count and existing real log', async () => {
 const js=await readFile(new URL('../vendor/noname/overrides/grail-history.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../vendor/noname/overrides/grail.css',import.meta.url),'utf8');
 assert.match(js,/toggle\.dataset\.mobileLabel\s*=\s*unread/);
 assert.match(js,/toggle\.setAttribute\('aria-label'/);
 assert.match(css, /#grail-history-toggle\[data-mobile-label\]::after\s*\{\s*content: attr\(data-mobile-label\)/);
 assert.match(js,/toggle\.addEventListener\('click'/);
});
test('mobile status chips preserve hand count and identifiable dangerous effects', async () => {
 const css=await readFile(new URL('../vendor/noname/overrides/grail-player-indicators.css',import.meta.url),'utf8');
 assert.match(css,/\.grail-indicator-shield, \.grail-indicator-heal/);
 assert.match(css,/#grail-player-indicators \.grail-indicator-hand \.grail-indicator-name\s*\{[\s\S]*?display: inline;/);
 assert.doesNotMatch(css, /\.grail-indicator-danger\s*\)\s*\.grail-indicator-name\s*\{\s*display:\s*none/);
 const js=await readFile(new URL('../vendor/noname/overrides/grail-player-indicators.js',import.meta.url),'utf8');
 assert.match(js,/item\.title\s*=/);
});
