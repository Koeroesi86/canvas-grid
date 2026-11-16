export interface MenuEntry {
  id: string;
  label: string;
  disabled: boolean;
}

/**
 * A small popup menu, made of plain elements so it is accessible and can reach past the grid's box.
 * It sits in the top layer (`popover`), which closes it on an outside click or Escape. It is built when first opened.
 */
export class ContextMenu {
  private element: HTMLElement | undefined;

  private readonly host: HTMLElement;

  private readonly onPick: (id: string) => void;

  /** `onPick` is called with the id of the entry the user picked, after the menu closed. */
  constructor(host: HTMLElement, onPick: (id: string) => void) {
    this.host = host;
    this.onPick = onPick;
  }

  get isOpen() {
    return this.element?.matches(':popover-open') ?? false;
  }

  /** Shows the entries with their top left corner at the viewport position, moved in if it would overflow. */
  open(clientX: number, clientY: number, entries: readonly MenuEntry[]) {
    this.close();
    const menu = this.element ?? this.create();
    menu.replaceChildren(...entries.map(entry => this.createItem(entry)));
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    menu.showPopover();

    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(0, Math.min(clientX, document.documentElement.clientWidth - width))}px`;
    menu.style.top = `${Math.max(0, Math.min(clientY, document.documentElement.clientHeight - height))}px`;
    this.items().find(item => !item.disabled)?.focus({ preventScroll: true });
  }

  close() {
    if (this.isOpen) this.element?.hidePopover();
  }

  private items() {
    return Array.from(this.element?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  }

  private create() {
    const menu = document.createElement('div');
    menu.className = 'contextMenu';
    menu.role = 'menu';
    menu.popover = 'auto';
    menu.addEventListener('keydown', this.onKeyDown);
    // light dismiss and Escape both end up here; focus goes back to the grid so the keyboard keeps working
    menu.addEventListener('toggle', event => {
      if ((event as ToggleEvent).newState === 'closed' && menu.contains(document.activeElement)) this.host.focus({ preventScroll: true });
    });
    this.host.append(menu);
    this.element = menu;
    return menu;
  }

  private createItem({ id, label, disabled }: MenuEntry) {
    const item = document.createElement('button');
    item.type = 'button';
    item.role = 'menuitem';
    item.textContent = label;
    item.disabled = disabled;
    item.addEventListener('click', () => {
      this.close();
      this.onPick(id);
    });
    return item;
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    // the menu sits inside the grid, which would also act on Enter, Escape and the rest, and cancel the click Enter makes
    event.stopPropagation();
    const items = this.items().filter(item => !item.disabled);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = (to: number) => items[(to + items.length) % items.length]?.focus();
    if (event.key === 'ArrowDown') step(index + 1);
    else if (event.key === 'ArrowUp') step(index < 0 ? -1 : index - 1);
    else if (event.key === 'Home') step(0);
    else if (event.key === 'End') step(-1);
    else if (event.key === 'Tab') this.close();
    else return;

    event.preventDefault();
  };
}

export default ContextMenu;
