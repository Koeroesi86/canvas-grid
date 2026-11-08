/**
 * Minimal declarative layer over the canvas 2D API.
 *
 * `<Group>` and friends do not draw when evaluated. They build a light tree of nodes, and calling
 * `node.draw(ctx, x, y)` paints it, with `(x, y)` as the origin that child positions are relative to.
 * Nothing is rasterized to an intermediate canvas unless a component opts into bitmap caching.
 */
export interface VNode {
  draw(ctx: CanvasRenderingContext2D, x: number, y: number): void;
}

/** `false`, `null` and `undefined` are skipped, so `{condition && <Rect />}` works. */
export type Child = VNode | false | null | undefined;

export type Children = Child | readonly Child[];

export interface ChildrenProps {
  /** A single child, an array of them, or the mix of both that JSX produces for several children. */
  children?: Children | readonly Children[];
}

export type Component<Props extends object> = (props: Props) => VNode;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = VNode;
    interface ElementChildrenAttribute {
      children: unknown;
    }
    interface IntrinsicElements {}
  }
}

const isNode = (child: Child): child is VNode => !!child;

/** Wraps a paint function into a leaf component; positions in `props` are relative to the draw origin. */
export const primitive = <Props extends object>(
  paint: (ctx: CanvasRenderingContext2D, props: Props, x: number, y: number) => void,
): Component<Props> => props => ({
  draw: (ctx, x, y) => paint(ctx, props, x, y),
});

export interface GroupProps extends ChildrenProps {
  x?: number;
  y?: number;
}

/** Draws its children relative to its own offset. */
export const Group: Component<GroupProps> = ({ x = 0, y = 0, children }) => ({
  draw: (ctx, originX, originY) => [children]
    .flat(2)
    .filter(isNode)
    .forEach(child => child.draw(ctx, originX + x, originY + y)),
});

const React = {
  createElement<Props extends object>(
    component: Component<Props & ChildrenProps>,
    props: Props | null,
    ...children: Children[]
  ): VNode {
    return component(Object.assign({}, props, { children }));
  },
};

export default React;
