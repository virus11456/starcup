// Minimal DOM/event boundary for the real history module. No browser layout
// emulation: viewport and Safari acceptance remain separate manual checks.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const historySource = await fs.readFile(new URL('../../vendor/noname/overrides/grail-history.js', import.meta.url), 'utf8');
const nativeSource = await fs.readFile(new URL('../../public/engine/noname/init/index.js', import.meta.url), 'utf8');
const ast = ts.createSourceFile('init.js', nativeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const nativeKeys = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'setWindowListener')?.getText(ast);
if (!nativeKeys) throw new Error('Native keyboard handler missing');

export function historyHarness() {
  const win = {}, calls = { auto: 0, pause: 0, reload: 0 };
  const observers = [];
  let doc;
  class Element {
    nodeType = 1;
    children = [];
    attributes = new Map();
    listeners = new Map();
    value = '';
    scrollTop = 0;
    hidden = false;
    ownText = '';
    constructor(tag) { this.tagName = tag.toUpperCase(); }
    set textContent(text) { this.ownText = String(text); this.children = []; }
    get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.get(key); }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children = []; this.ownText = ''; this.append(...nodes); }
    focus() { doc.activeElement = this; }
    addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
    emit(type, values = {}) {
      const event = { target: this, cancelBubble: false, defaultPrevented: false, ...values,
        stopPropagation() { this.cancelBubble = true; }, preventDefault() { this.defaultPrevented = true; } };
      for (let current = this; current; current = current.parentElement) {
        for (const listener of current.listeners.get(type) || []) listener(event);
        if (event.cancelBubble) return event;
      }
      if (type === 'keydown') win.onkeydown?.(event);
      return event;
    }
  }
  doc = { createElement: tag => new Element(tag), querySelectorAll: () => [] };
  const parent = new Element('div'), sidebar = new Element('div');
  let turn = 1;
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const game = { closePopped() {}, reload() { calls.reload++; } };
  const ui = {
    menuContainer: { classList: { contains: () => true } },
    window: { querySelector: () => null },
    click: { pause() { calls.pause++; } }, auto: { click() { calls.auto++; } },
  };
  const create = vm.runInNewContext(historySource.replaceAll('export function', 'function') + '\n' + nativeKeys + '\nsetWindowListener();\ncreateBattleHistory;',
    { document: doc, MutationObserver: Observer, window: win, game, ui, lib: {} });
  const history = create(parent, () => turn);
  history.attach(sidebar);
  const [toggle, panel] = parent.children;
  const [header, search, fresh, summary, list, more] = panel.children;
  return { calls, doc, toggle, panel, search, fresh, summary, list, more, close: header.children[1], history,
    keyOnTable(values) { return parent.emit('keydown', values); },
    append(text, nextTurn = turn) {
      turn = nextTurn;
      const node = new Element('div'); node.textContent = text;
      sidebar.children.unshift(node);
      for (const observer of observers) if (!observer.disconnected) observer.callback([{ addedNodes: [node] }]);
    },
  };
}
