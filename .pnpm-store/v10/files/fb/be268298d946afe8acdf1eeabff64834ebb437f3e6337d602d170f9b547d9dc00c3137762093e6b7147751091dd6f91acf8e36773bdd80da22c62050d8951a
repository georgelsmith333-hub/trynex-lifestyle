import { ClientBuilder, ClientExtraFilesBuilder, ClientFooterBuilder, ClientGeneratorsBuilder, ClientHeaderBuilder, GeneratorDependency } from "@orval/core";

//#region src/index.d.ts
declare const getHonoDependencies: () => GeneratorDependency[];
declare const getHonoHeader: ClientHeaderBuilder;
declare const getHonoFooter: ClientFooterBuilder;
declare const generateHono: ClientBuilder;
/**
 * extractExistingHandlerBodies scans a previously generated handler file and
 * returns the user-authored body of each
 * `async (c: ...) => { /* body *\/ }` block keyed by handler name.
 *
 * We deliberately preserve only the inner body — not the surrounding
 * `factory.createHandlers(...)` call — so the regenerated wrapper always
 * reflects the current validator chain and imports. The scanner is
 * lex-aware: it skips strings, template literals, regex literals, and
 * comments while counting parentheses/braces, so user code containing
 * `)` or `}` characters in those contexts does not confuse the matcher.
 */
declare const extractExistingHandlerBodies: (source: string) => Map<string, string>;
declare const generateExtraFiles: ClientExtraFilesBuilder;
declare const builder: () => () => ClientGeneratorsBuilder;
//#endregion
export { builder, builder as default, extractExistingHandlerBodies, generateExtraFiles, generateHono, getHonoDependencies, getHonoFooter, getHonoHeader };
//# sourceMappingURL=index.d.mts.map