import Renderer from '../Renderer';
import Block from '../Block';
import Tag from './shared/Tag';
import Wrapper from './shared/Wrapper';
import MustacheTag from '../../nodes/MustacheTag';
import RawMustacheTag from '../../nodes/RawMustacheTag';
import { Identifier } from 'estree';
export default class MustacheTagWrapper extends Tag {
    var: Identifier;
    constructor(renderer: Renderer, block: Block, parent: Wrapper, node: MustacheTag | RawMustacheTag);
    render(block: Block, parent_node: Identifier, parent_nodes: Identifier, data: Record<string, unknown> | undefined): void;
}
