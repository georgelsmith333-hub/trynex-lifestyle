import nodePath from "node:path";
import { camel, generateMutatorImports, getFileInfo, getOrvalGeneratedTypes, getParamsInPath, isObject, jsDoc, kebab, pascal, sanitize, upath } from "@orval/core";
import { generateZod } from "@orval/zod";
import fs from "fs-extra";
//#region src/route.ts
const hasParam = (path) => /[^{]*{[\w*_-]*}.*/.test(path);
const getRoutePath = (path) => {
	const matches = /([^{]*){?([\w*_-]*)}?(.*)/.exec(path);
	if (!matches?.length) return path;
	const prev = matches[1];
	const param = sanitize(matches[2], {
		es5keyword: true,
		underscore: true,
		dash: true,
		dot: true
	});
	const next = hasParam(matches[3]) ? getRoutePath(matches[3]) : matches[3];
	return hasParam(path) ? `${prev}:${param}${next}` : `${prev}${param}${next}`;
};
const getRoute = (route) => {
	const splittedRoute = route.split("/");
	let acc = "";
	for (const [i, path] of splittedRoute.entries()) {
		if (!path && i === 0) continue;
		acc += path.includes("{") ? `/${getRoutePath(path)}` : `/${path}`;
	}
	return acc;
};
//#endregion
//#region src/index.ts
const ZVALIDATOR_SOURCE = fs.readFileSync(nodePath.join(import.meta.dirname, "zValidator.ts")).toString("utf8");
const HONO_DEPENDENCIES = [{
	exports: [
		{
			name: "Hono",
			values: true
		},
		{ name: "Context" },
		{ name: "Env" }
	],
	dependency: "hono"
}];
/**
* generateModuleSpecifier generates the specifier that _from_ would use to
* import _to_. This is syntactical and does not validate the paths.
*
* @param from The filesystem path to the importer.
* @param to If a filesystem path, it and _from_ must be use the same frame of
* reference, such as process.cwd() or both be absolute. If only one is
* absolute, the other must be relative to process.cwd().
*
* Otherwise, treated as a package name and returned directly.
*
* @return A module specifier that can be used at _from_ to import _to_. It is
* extensionless to conform with the rest of orval.
*/
const generateModuleSpecifier = (from, to) => {
	if (to.startsWith(".") || nodePath.isAbsolute(to)) return upath.getRelativeImportPath(nodePath.resolve(from), nodePath.resolve(to), true).replace(/\.ts$/, "");
	return to;
};
const getHonoDependencies = () => HONO_DEPENDENCIES;
const getHonoHeader = ({ verbOptions, output, tag, clientImplementation }) => {
	const targetInfo = getFileInfo(output.target);
	let handlers;
	const importHandlers = Object.values(verbOptions).filter((verbOption) => clientImplementation.includes(`${verbOption.operationName}Handlers`));
	if (output.override.hono.handlers) {
		const handlerFileInfo = getFileInfo(output.override.hono.handlers);
		handlers = importHandlers.map((verbOption) => {
			const isSplitDir = output.mode === "tags-split";
			const tag = kebab(verbOption.tags[0] ?? "default");
			const handlersPath = upath.relativeSafe(nodePath.join(targetInfo.dirname, isSplitDir ? tag : ""), nodePath.join(handlerFileInfo.dirname, `./${verbOption.operationName}`));
			return `import { ${verbOption.operationName}Handlers } from '${handlersPath}';`;
		}).join("\n");
	} else handlers = `import {\n${importHandlers.map((verbOption) => ` ${verbOption.operationName}Handlers`).join(`, \n`)}\n} from './${tag ?? targetInfo.filename}.handlers';`;
	return `${handlers}\n\nconst app = new Hono()\n`;
};
const getHonoFooter = () => ";\n\nexport default app;\n";
const generateHonoRoute = ({ operationName, verb }, pathRoute) => {
	const path = getRoute(pathRoute);
	return `\n  .${verb.toLowerCase()}('${path}', ...${operationName}Handlers)`;
};
const generateHono = (verbOptions, options) => {
	if (options.override.hono.compositeRoute) return {
		implementation: "",
		imports: []
	};
	return {
		implementation: `${generateHonoRoute(verbOptions, options.pathRoute)}\n`,
		imports: [
			...verbOptions.params.flatMap((param) => param.imports),
			...verbOptions.body.imports,
			...verbOptions.queryParams ? [{ name: verbOptions.queryParams.schema.name }] : []
		]
	};
};
/**
* getHonoHandlers generates TypeScript code for the given verbs and reports
* whether the code requires zValidator.
*/
const DEFAULT_HANDLER_BODY = "\n\n  ";
const getHonoHandlers = (...opts) => {
	let code = "";
	let hasZValidator = false;
	for (const { handlerName, contextTypeName, verbOption, validator, bodyOverride } of opts) {
		let currentValidator = "";
		if (validator) {
			const pascalOperationName = pascal(verbOption.operationName);
			if (verbOption.headers) currentValidator += `zValidator('header', ${pascalOperationName}Header),\n`;
			if (verbOption.params.length > 0) currentValidator += `zValidator('param', ${pascalOperationName}Params),\n`;
			if (verbOption.queryParams) currentValidator += `zValidator('query', ${pascalOperationName}QueryParams),\n`;
			if (verbOption.body.definition) currentValidator += `zValidator('json', ${pascalOperationName}Body),\n`;
			if (validator !== "hono" && verbOption.response.originalSchema?.["200"]?.content?.["application/json"]) currentValidator += `zValidator('response', ${pascalOperationName}Response),\n`;
		}
		code += `
export const ${handlerName} = factory.createHandlers(
${currentValidator}async (c: ${contextTypeName}) => {${bodyOverride ?? DEFAULT_HANDLER_BODY}},
);`;
		hasZValidator ||= currentValidator !== "";
	}
	return [code, hasZValidator];
};
const getZvalidatorImports = (verbOptions, importPath, isHonoValidator) => {
	const specifiers = [];
	for (const { operationName, headers, params, queryParams, body, response } of verbOptions) {
		const pascalOperationName = pascal(operationName);
		if (headers) specifiers.push(`${pascalOperationName}Header`);
		if (params.length > 0) specifiers.push(`${pascalOperationName}Params`);
		if (queryParams) specifiers.push(`${pascalOperationName}QueryParams`);
		if (body.definition) specifiers.push(`${pascalOperationName}Body`);
		if (!isHonoValidator && response.originalSchema?.["200"]?.content?.["application/json"] != void 0) specifiers.push(`${pascalOperationName}Response`);
	}
	return specifiers.length === 0 ? "" : `import {\n${specifiers.join(",\n")}\n} from '${importPath}'`;
};
const getVerbOptionGroupByTag = (verbOptions) => {
	const grouped = {};
	for (const value of Object.values(verbOptions)) {
		const tag = value.tags[0];
		if (!grouped[tag]) grouped[tag] = [];
		grouped[tag].push(value);
	}
	return grouped;
};
const generateHandlerFile = async ({ verbs, path, header, validatorModule, zodModule, contextModule }) => {
	const validator = validatorModule === "@hono/zod-validator" ? "hono" : validatorModule != void 0;
	const verbList = Object.values(verbs);
	const [, hasZValidator] = getHonoHandlers(...verbList.map((verbOption) => ({
		handlerName: `${verbOption.operationName}Handlers`,
		contextTypeName: `${pascal(verbOption.operationName)}Context`,
		verbOption,
		validator
	})));
	const imports = ["import { createFactory } from 'hono/factory';"];
	if (hasZValidator && validatorModule != void 0) imports.push(`import { zValidator } from '${generateModuleSpecifier(path, validatorModule)}';`);
	imports.push(`import { ${verbList.map((verb) => `${pascal(verb.operationName)}Context`).join(",\n")} } from '${generateModuleSpecifier(path, contextModule)}';`);
	if (hasZValidator) imports.push(getZvalidatorImports(verbList, generateModuleSpecifier(path, zodModule), validatorModule === "@hono/zod-validator"));
	const preamble = `${header}${imports.filter((imp) => imp !== "").join("\n")}\n\nconst factory = createFactory();`;
	const existingBodies = fs.existsSync(path) ? extractExistingHandlerBodies(await fs.readFile(path, "utf8")) : /* @__PURE__ */ new Map();
	const [handlerCode] = getHonoHandlers(...verbList.map((verbOption) => ({
		handlerName: `${verbOption.operationName}Handlers`,
		contextTypeName: `${pascal(verbOption.operationName)}Context`,
		verbOption,
		validator,
		bodyOverride: existingBodies.get(`${verbOption.operationName}Handlers`)
	})));
	return `${preamble}${handlerCode}`;
};
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
const extractExistingHandlerBodies = (source) => {
	const bodies = /* @__PURE__ */ new Map();
	const exportRegex = /export\s+const\s+(\w+Handlers)\s*=\s*factory\.createHandlers\s*\(/g;
	let match;
	while ((match = exportRegex.exec(source)) !== null) {
		const handlerName = match[1];
		const callOpenIdx = match.index + match[0].length - 1;
		const callCloseIdx = findMatchingClose(source, callOpenIdx, "(", ")");
		if (callCloseIdx === -1) continue;
		const body = extractAsyncArrowBody(source.slice(callOpenIdx + 1, callCloseIdx));
		if (body !== void 0) bodies.set(handlerName, body);
	}
	return bodies;
};
/**
* findMatchingClose returns the index of the closing bracket that pairs with
* the opening bracket at `openIdx`, or -1 if unbalanced. The scan skips
* strings, template literals, regex literals, and comments so brackets in
* those contexts do not affect depth.
*/
const findMatchingClose = (source, openIdx, open, close) => {
	let depth = 0;
	let i = openIdx;
	while (i < source.length) {
		const ch = source[i];
		const next = source[i + 1];
		if (ch === "/" && next === "/") {
			const nl = source.indexOf("\n", i + 2);
			i = nl === -1 ? source.length : nl + 1;
			continue;
		}
		if (ch === "/" && next === "*") {
			const end = source.indexOf("*/", i + 2);
			i = end === -1 ? source.length : end + 2;
			continue;
		}
		if (ch === "'" || ch === "\"" || ch === "`") {
			i = skipString(source, i, ch);
			continue;
		}
		if (ch === "/" && isRegexContext(source, i)) {
			i = skipRegex(source, i);
			continue;
		}
		if (ch === open) depth++;
		else if (ch === close) {
			depth--;
			if (depth === 0) return i;
		}
		i++;
	}
	return -1;
};
const skipString = (source, start, quote) => {
	let i = start + 1;
	while (i < source.length) {
		const ch = source[i];
		if (ch === "\\") {
			i += 2;
			continue;
		}
		if (quote === "`" && ch === "$" && source[i + 1] === "{") {
			const end = findMatchingClose(source, i + 1, "{", "}");
			i = end === -1 ? source.length : end + 1;
			continue;
		}
		if (ch === quote) return i + 1;
		i++;
	}
	return source.length;
};
const skipRegex = (source, start) => {
	let i = start + 1;
	let inClass = false;
	while (i < source.length) {
		const ch = source[i];
		if (ch === "\\") {
			i += 2;
			continue;
		}
		if (ch === "[") inClass = true;
		else if (ch === "]") inClass = false;
		else if (ch === "/" && !inClass) {
			i++;
			while (i < source.length && /[gimsuy]/.test(source[i])) i++;
			return i;
		}
		if (ch === "\n") return start + 1;
		i++;
	}
	return source.length;
};
const REGEX_PRECEDING_KEYWORDS = new Set([
	"return",
	"throw",
	"yield",
	"await",
	"case",
	"new",
	"typeof",
	"void",
	"delete",
	"in",
	"of",
	"instanceof"
]);
const isRegexContext = (source, slashIdx) => {
	let j = slashIdx - 1;
	while (j >= 0 && (source[j] === " " || source[j] === "	" || source[j] === "\n")) j--;
	if (j < 0) return true;
	const c = source[j];
	if (c === ".") {
		if (j >= 2 && source[j - 1] === "." && source[j - 2] === ".") return true;
		return false;
	}
	if (/[A-Za-z0-9_$]/.test(c)) {
		let k = j;
		while (k >= 0 && /[A-Za-z0-9_$]/.test(source[k])) k--;
		const token = source.slice(k + 1, j + 1);
		return REGEX_PRECEDING_KEYWORDS.has(token);
	}
	if (c === ")" || c === "]") return false;
	return true;
};
/**
* extractAsyncArrowBody finds the trailing `async (c: ...) => { ... }`
* argument inside `factory.createHandlers(...)` and returns the inner body
* (without the surrounding braces). Returns undefined when the call does not
* end with the expected arrow function shape.
*/
const extractAsyncArrowBody = (callBody) => {
	let i = 0;
	let lastTopLevelArrow = -1;
	while (i < callBody.length) {
		const ch = callBody[i];
		const next = callBody[i + 1];
		if (ch === "/" && next === "/") {
			const nl = callBody.indexOf("\n", i + 2);
			i = nl === -1 ? callBody.length : nl + 1;
			continue;
		}
		if (ch === "/" && next === "*") {
			const end = callBody.indexOf("*/", i + 2);
			i = end === -1 ? callBody.length : end + 2;
			continue;
		}
		if (ch === "'" || ch === "\"" || ch === "`") {
			i = skipString(callBody, i, ch);
			continue;
		}
		if (ch === "/" && isRegexContext(callBody, i)) {
			i = skipRegex(callBody, i);
			continue;
		}
		if (ch === "(" || ch === "{") {
			const end = findMatchingClose(callBody, i, ch, ch === "(" ? ")" : "}");
			i = end === -1 ? callBody.length : end + 1;
			continue;
		}
		if (ch === "=" && next === ">") {
			lastTopLevelArrow = i;
			i += 2;
			continue;
		}
		i++;
	}
	if (lastTopLevelArrow === -1) return void 0;
	let j = lastTopLevelArrow + 2;
	while (j < callBody.length && /\s/.test(callBody[j])) j++;
	if (callBody[j] !== "{") return void 0;
	const closeIdx = findMatchingClose(callBody, j, "{", "}");
	if (closeIdx === -1) return void 0;
	return callBody.slice(j + 1, closeIdx);
};
const generateHandlerFiles = async (verbOptions, output, context, validatorModule) => {
	const header = getHeader(output.override.header, getSpecInfo(context));
	const { extension, dirname, filename } = getFileInfo(output.target);
	if (output.override.hono.handlers) return Promise.all(Object.values(verbOptions).map(async (verbOption) => {
		const tag = kebab(verbOption.tags[0] ?? "default");
		const path = nodePath.join(output.override.hono.handlers ?? "", `./${verbOption.operationName}` + extension);
		let zodModule;
		let contextModule;
		if (output.mode === "tags") {
			zodModule = nodePath.join(dirname, `${kebab(tag)}.zod`);
			contextModule = nodePath.join(dirname, `${kebab(tag)}.context`);
		} else if (output.mode === "tags-split") {
			zodModule = nodePath.join(dirname, tag, tag + ".zod");
			contextModule = nodePath.join(dirname, tag, tag + ".context");
		} else {
			zodModule = nodePath.join(dirname, `${filename}.zod`);
			contextModule = nodePath.join(dirname, `${filename}.context`);
		}
		return {
			content: await generateHandlerFile({
				path,
				header,
				verbs: [verbOption],
				validatorModule,
				zodModule,
				contextModule
			}),
			path
		};
	}));
	if (output.mode === "tags" || output.mode === "tags-split") {
		const groupByTags = getVerbOptionGroupByTag(verbOptions);
		return Promise.all(Object.entries(groupByTags).map(async ([tag, verbs]) => {
			const handlerPath = output.mode === "tags" ? nodePath.join(dirname, `${kebab(tag)}.handlers${extension}`) : nodePath.join(dirname, tag, tag + ".handlers" + extension);
			return {
				content: await generateHandlerFile({
					path: handlerPath,
					header,
					verbs,
					validatorModule,
					zodModule: output.mode === "tags" ? nodePath.join(dirname, `${kebab(tag)}.zod`) : nodePath.join(dirname, tag, tag + ".zod"),
					contextModule: output.mode === "tags" ? nodePath.join(dirname, `${kebab(tag)}.context`) : nodePath.join(dirname, tag, tag + ".context")
				}),
				path: handlerPath
			};
		}));
	}
	const handlerPath = nodePath.join(dirname, `${filename}.handlers${extension}`);
	return [{
		content: await generateHandlerFile({
			path: handlerPath,
			header,
			verbs: Object.values(verbOptions),
			validatorModule,
			zodModule: nodePath.join(dirname, `${filename}.zod`),
			contextModule: nodePath.join(dirname, `${filename}.context`)
		}),
		path: handlerPath
	}];
};
const getContext = (verbOption) => {
	let paramType = "";
	if (verbOption.params.length > 0) paramType = `param: {\n ${getParamsInPath(verbOption.pathRoute).map((name) => {
		const param = verbOption.params.find((p) => p.name === sanitize(camel(name), { es5keyword: true }));
		const definition = param?.definition.split(":")[1];
		return { definition: `${name}${param?.required ?? false ? "" : "?"}:${definition}` };
	}).map((property) => property.definition).join(",\n    ")},\n },`;
	const queryType = verbOption.queryParams ? `query: ${verbOption.queryParams.schema.name},` : "";
	const bodyType = verbOption.body.definition ? `json: ${verbOption.body.definition},` : "";
	const hasIn = !!paramType || !!queryType || !!bodyType;
	return `export type ${pascal(verbOption.operationName)}Context<E extends Env = any> = Context<E, '${getRoute(verbOption.pathRoute)}'${hasIn ? `, { in: { ${paramType}${queryType}${bodyType} }, out: { ${paramType}${queryType}${bodyType} } }` : ""}>`;
};
const getHeader = (option, info) => {
	if (!option) return "";
	const header = option(info);
	return Array.isArray(header) ? jsDoc({ description: header }) : header;
};
const getSpecInfo = (context) => context.spec.info ?? {
	title: "API",
	version: "1.0.0"
};
const generateContextFile = ({ path, verbs, schemaModule }) => {
	let content = `import type { Context, Env } from 'hono';\n\n`;
	const contexts = verbs.map((verb) => getContext(verb));
	const imps = new Set(verbs.flatMap((verb) => {
		const imports = [];
		if (verb.params.length > 0) imports.push(...verb.params.flatMap((param) => param.imports));
		if (verb.queryParams) imports.push({ name: verb.queryParams.schema.name });
		if (verb.body.definition) imports.push(...verb.body.imports);
		return imports;
	}).map((imp) => imp.name).filter((imp) => contexts.some((context) => context.includes(imp))));
	if (contexts.some((context) => context.includes("NonReadonly<"))) {
		content += getOrvalGeneratedTypes();
		content += "\n";
	}
	if (imps.size > 0) content += `import type {\n${[...imps].toSorted().join(",\n  ")}\n} from '${generateModuleSpecifier(path, schemaModule)}';\n\n`;
	content += contexts.join("\n");
	return content;
};
const generateContextFiles = (verbOptions, output, context, schemaModule) => {
	const header = getHeader(output.override.header, getSpecInfo(context));
	const { extension, dirname, filename } = getFileInfo(output.target);
	if (output.mode === "tags" || output.mode === "tags-split") {
		const groupByTags = getVerbOptionGroupByTag(verbOptions);
		return Object.entries(groupByTags).map(([tag, verbs]) => {
			const path = output.mode === "tags" ? nodePath.join(dirname, `${kebab(tag)}.context${extension}`) : nodePath.join(dirname, tag, tag + ".context" + extension);
			return {
				content: `${header}${generateContextFile({
					verbs,
					path,
					schemaModule
				})}`,
				path
			};
		});
	}
	const path = nodePath.join(dirname, `${filename}.context${extension}`);
	return [{
		content: `${header}${generateContextFile({
			verbs: Object.values(verbOptions),
			path,
			schemaModule
		})}`,
		path
	}];
};
const generateZodFiles = async (verbOptions, output, context) => {
	const { extension, dirname, filename } = getFileInfo(output.target);
	const header = getHeader(output.override.header, getSpecInfo(context));
	if (output.mode === "tags" || output.mode === "tags-split") {
		const groupByTags = getVerbOptionGroupByTag(verbOptions);
		return (await Promise.all(Object.entries(groupByTags).map(async ([tag, verbs]) => {
			const zods = await Promise.all(verbs.map(async (verbOption) => generateZod(verbOption, {
				route: verbOption.route,
				pathRoute: verbOption.pathRoute,
				override: output.override,
				context,
				mock: output.mock,
				output: output.target
			}, output.client)));
			if (zods.every((z) => z.implementation === "")) return {
				content: "",
				path: ""
			};
			let content = `${header}import { z as zod } from 'zod';\n${generateMutatorImports({ mutators: new Map(zods.flatMap((z) => z.mutators ?? []).map((m) => [m.name, m])).values().toArray() })}\n`;
			const zodPath = output.mode === "tags" ? nodePath.join(dirname, `${kebab(tag)}.zod${extension}`) : nodePath.join(dirname, tag, tag + ".zod" + extension);
			content += zods.map((zod) => zod.implementation).join("\n");
			return {
				content,
				path: zodPath
			};
		}))).filter((context) => context.content !== "");
	}
	const zods = await Promise.all(Object.values(verbOptions).map(async (verbOption) => generateZod(verbOption, {
		route: verbOption.route,
		pathRoute: verbOption.pathRoute,
		override: output.override,
		context,
		mock: output.mock,
		output: output.target
	}, output.client)));
	let content = `${header}import { z as zod } from 'zod';\n${generateMutatorImports({ mutators: new Map(zods.flatMap((z) => z.mutators ?? []).map((m) => [m.name, m])).values().toArray() })}\n`;
	const zodPath = nodePath.join(dirname, `${filename}.zod${extension}`);
	content += zods.map((zod) => zod.implementation).join("\n");
	return [{
		content,
		path: zodPath
	}];
};
const generateZvalidator = (output, context) => {
	const header = getHeader(output.override.header, getSpecInfo(context));
	let validatorPath = output.override.hono.validatorOutputPath;
	if (!output.override.hono.validatorOutputPath) {
		const { extension, dirname, filename } = getFileInfo(output.target);
		validatorPath = nodePath.join(dirname, `${filename}.validator${extension}`);
	}
	return {
		content: `${header}${ZVALIDATOR_SOURCE}`,
		path: validatorPath
	};
};
const generateCompositeRoutes = (verbOptions, output, context) => {
	const targetInfo = getFileInfo(output.target);
	const compositeRouteInfo = getFileInfo(output.override.hono.compositeRoute);
	const header = getHeader(output.override.header, getSpecInfo(context));
	const routes = Object.values(verbOptions).map((verbOption) => {
		return generateHonoRoute(verbOption, verbOption.pathRoute);
	}).join("");
	const importHandlers = Object.values(verbOptions);
	let ImportHandlersImplementation;
	if (output.override.hono.handlers) {
		const handlerFileInfo = getFileInfo(output.override.hono.handlers);
		ImportHandlersImplementation = importHandlers.map((verbOption) => verbOption.operationName).map((operationName) => {
			return `import { ${`${operationName}Handlers`} } from '${generateModuleSpecifier(compositeRouteInfo.path, nodePath.join(handlerFileInfo.dirname, `./${operationName}`))}';`;
		}).join("\n");
	} else {
		const tags = importHandlers.map((verbOption) => kebab(verbOption.tags[0] ?? "default"));
		ImportHandlersImplementation = tags.filter((t, i) => tags.indexOf(t) === i).map((tag) => {
			return `import {\n${importHandlers.filter((verbOption) => verbOption.tags[0] === tag).map((verbOption) => ` ${verbOption.operationName}Handlers`).join(`, \n`)}\n} from '${generateModuleSpecifier(compositeRouteInfo.path, nodePath.join(targetInfo.dirname, tag))}/${tag}.handlers';`;
		}).join("\n");
	}
	return [{
		content: `${header}import { Hono } from 'hono';
${ImportHandlersImplementation}

const app = new Hono()${routes};

export default app;
`,
		path: output.override.hono.compositeRoute || ""
	}];
};
const generateExtraFiles = async (verbOptions, output, context) => {
	const { path, pathWithoutExtension } = getFileInfo(output.target);
	const validator = generateZvalidator(output, context);
	let schemaModule;
	if (output.schemas != void 0) schemaModule = getFileInfo(isObject(output.schemas) ? output.schemas.path : output.schemas).dirname;
	else if (output.mode === "single") schemaModule = path;
	else schemaModule = `${pathWithoutExtension}.schemas`;
	const contexts = generateContextFiles(verbOptions, output, context, schemaModule);
	const compositeRoutes = output.override.hono.compositeRoute ? generateCompositeRoutes(verbOptions, output, context) : [];
	const [handlers, zods] = await Promise.all([generateHandlerFiles(verbOptions, output, context, validator.path), generateZodFiles(verbOptions, output, context)]);
	return [
		...handlers,
		...contexts,
		...zods,
		...output.override.hono.validator && output.override.hono.validator !== "hono" ? [validator] : [],
		...compositeRoutes
	];
};
const honoClientBuilder = {
	client: generateHono,
	dependencies: getHonoDependencies,
	header: getHonoHeader,
	footer: getHonoFooter,
	extraFiles: generateExtraFiles
};
const builder = () => () => honoClientBuilder;
//#endregion
export { builder, builder as default, extractExistingHandlerBodies, generateExtraFiles, generateHono, getHonoDependencies, getHonoFooter, getHonoHeader };

//# sourceMappingURL=index.mjs.map