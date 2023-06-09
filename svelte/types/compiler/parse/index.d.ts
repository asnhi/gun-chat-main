import { TemplateNode, Ast, ParserOptions, Fragment, Style, Script } from '../interfaces';
interface LastAutoClosedTag {
    tag: string;
    reason: string;
    depth: number;
}
export declare class Parser {
    readonly template: string;
    readonly filename?: string;
    readonly customElement: boolean;
    readonly css_mode: 'injected' | 'external' | 'none' | boolean;
    index: number;
    stack: TemplateNode[];
    html: Fragment;
    css: Style[];
    js: Script[];
    meta_tags: {};
    last_auto_closed_tag?: LastAutoClosedTag;
    constructor(template: string, options: ParserOptions);
    current(): TemplateNode;
    acorn_error(err: any): void;
    error({ code, message }: {
        code: string;
        message: string;
    }, index?: number): void;
    eat(str: string, required?: boolean, error?: {
        code: string;
        message: string;
    }): boolean;
    match(str: string): boolean;
    /**
     * Match a regex at the current index
     * @param pattern Should have a ^ anchor at the start so the regex doesn't search past the beginning, resulting in worse performance
     */
    match_regex(pattern: RegExp): string;
    allow_whitespace(): void;
    /**
     * Search for a regex starting at the current index and return the result if it matches
     * @param pattern Should have a ^ anchor at the start so the regex doesn't search past the beginning, resulting in worse performance
     */
    read(pattern: RegExp): string;
    read_identifier(allow_reserved?: boolean): string;
    read_until(pattern: RegExp, error_message?: Parameters<Parser['error']>[0]): string;
    require_whitespace(): void;
}
export default function parse(template: string, options?: ParserOptions): Ast;
export {};
