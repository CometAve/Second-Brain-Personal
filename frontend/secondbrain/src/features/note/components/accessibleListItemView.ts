import { listItemSchema } from '@milkdown/kit/preset/commonmark';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose, $view } from '@milkdown/kit/utils';

function syncListMarkers(editor: HTMLElement): void {
  const orderedNumbers = new WeakMap<HTMLOListElement, number>();
  const items = editor.querySelectorAll<HTMLLIElement>(
    'ol > li.milkdown-list-item-block, ul > li.milkdown-list-item-block',
  );
  for (const item of items) {
    const parent = item.parentElement;
    const marker = item.querySelector<HTMLElement>(':scope > .label-wrapper > .label');
    const checkbox = item.querySelector<HTMLInputElement>(
      ':scope > .label-wrapper > input[data-note-task-checkbox]',
    );
    if (!parent || !marker || !checkbox) continue;

    let label = '•';
    if (parent instanceof HTMLOListElement) {
      const current = orderedNumbers.get(parent) ?? parent.start;
      orderedNumbers.set(parent, current + 1);
      label = `${current}.`;
    }
    if (checkbox.hidden && marker.textContent !== label) marker.textContent = label;
  }
}

// A block drag can move an existing list item into a different list without
// changing its attrs. Reconcile visible markers from the actual parent list
// after each document change; Markdown remains owned by the Milkdown schema.
export const listMarkerSync = $prose(
  () =>
    new Plugin({
      view: (view) => {
        syncListMarkers(view.dom);
        return {
          update(nextView, previousState) {
            if (!previousState.doc.eq(nextView.state.doc)) syncListMarkers(nextView.dom);
          },
        };
      },
    }),
);

// Crepe 7.22.2 renders <ul><div><li>…</li></div></ul. The outer div breaks
// list semantics, so use a native <li> while retaining Milkdown's GFM schema,
// list commands, block editing, and task state.
export const accessibleListItemView = $view(
  listItemSchema.node,
  () => (initialNode, view, getPos) => {
    const dom = document.createElement('li');
    dom.className = 'milkdown-list-item-block list-item';

    const labelWrapper = document.createElement('div');
    labelWrapper.className = 'label-wrapper';
    labelWrapper.contentEditable = 'false';
    const marker = document.createElement('span');
    marker.className = 'label';
    marker.setAttribute('aria-hidden', 'true');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.noteTaskCheckbox = 'true';
    checkbox.setAttribute('aria-label', '할 일 완료');
    let currentChecked = initialNode.attrs.checked === true;
    checkbox.addEventListener('change', () => {
      const pos = getPos();
      if (!view.editable || pos == null) {
        checkbox.checked = currentChecked;
        return;
      }
      view.dispatch(view.state.tr.setNodeAttribute(pos, 'checked', checkbox.checked));
    });
    labelWrapper.append(marker, checkbox);

    const children = document.createElement('div');
    children.className = 'children';
    const contentDOM = document.createElement('div');
    contentDOM.className = 'content-dom';
    contentDOM.dataset.contentDom = 'true';
    children.append(contentDOM);
    dom.append(labelWrapper, children);

    const render = (node: typeof initialNode) => {
      const isTask = typeof node.attrs.checked === 'boolean';
      currentChecked = node.attrs.checked === true;
      checkbox.hidden = !isTask;
      checkbox.disabled = !view.editable;
      checkbox.checked = currentChecked;
      marker.hidden = isTask;
      marker.textContent = node.attrs.listType === 'ordered' ? String(node.attrs.label) : '•';
      const taskText = node.firstChild?.textContent.trim() ?? '';
      checkbox.setAttribute('aria-label', taskText ? `${taskText} 완료` : '할 일 완료');
      dom.dataset.label = String(node.attrs.label);
      dom.dataset.listType = String(node.attrs.listType);
      dom.dataset.spread = String(node.attrs.spread);
      if (isTask) dom.dataset.checked = String(node.attrs.checked);
      else delete dom.dataset.checked;
    };
    render(initialNode);

    return {
      dom,
      contentDOM,
      update(updatedNode) {
        if (updatedNode.type !== initialNode.type) return false;
        render(updatedNode);
        return true;
      },
      stopEvent(event) {
        return event.target instanceof Node && labelWrapper.contains(event.target);
      },
      ignoreMutation(mutation) {
        if (mutation.type === 'selection') return false;
        if (mutation.target === contentDOM && mutation.type === 'attributes') return true;
        return !contentDOM.contains(mutation.target);
      },
      selectNode() {
        dom.classList.add('ProseMirror-selectednode');
      },
      deselectNode() {
        dom.classList.remove('ProseMirror-selectednode');
      },
    };
  },
);
