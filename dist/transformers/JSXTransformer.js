Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }


var _xhtml = require('../parser/plugins/jsx/xhtml'); var _xhtml2 = _interopRequireDefault(_xhtml);
var _types = require('../parser/tokenizer/types');
var _charcodes = require('../parser/util/charcodes');

var _getJSXPragmaInfo = require('../util/getJSXPragmaInfo'); var _getJSXPragmaInfo2 = _interopRequireDefault(_getJSXPragmaInfo);

var _Transformer = require('./Transformer'); var _Transformer2 = _interopRequireDefault(_Transformer);

 class JSXTransformer extends _Transformer2.default {
  __init() {this.lastLineNumber = 1}
  __init2() {this.lastIndex = 0}
  __init3() {this.filenameVarName = null}
  

  constructor(
     rootTransformer,
     tokens,
     importProcessor,
     nameManager,
     options,
  ) {
    super();this.rootTransformer = rootTransformer;this.tokens = tokens;this.importProcessor = importProcessor;this.nameManager = nameManager;this.options = options;JSXTransformer.prototype.__init.call(this);JSXTransformer.prototype.__init2.call(this);JSXTransformer.prototype.__init3.call(this);;
    this.jsxPragmaInfo = _getJSXPragmaInfo2.default.call(void 0, options);
  }

  process() {
    if (this.tokens.matches1(_types.TokenType.jsxTagStart)) {
      this.processJSXTag();
      return true;
    }
    return false;
  }

  getPrefixCode() {
    if (this.filenameVarName) {
      return `const ${this.filenameVarName} = ${JSON.stringify(this.options.filePath || "")};`;
    } else {
      return "";
    }
  }

  /**
   * Lazily calculate line numbers to avoid unneeded work. We assume this is always called in
   * increasing order by index.
   */
  getLineNumberForIndex(index) {
    const code = this.tokens.code;
    while (this.lastIndex < index && this.lastIndex < code.length) {
      if (code[this.lastIndex] === "\n") {
        this.lastLineNumber++;
      }
      this.lastIndex++;
    }
    return this.lastLineNumber;
  }

  getFilenameVarName() {
    if (!this.filenameVarName) {
      this.filenameVarName = this.nameManager.claimFreeName("_jsxFileName");
    }
    return this.filenameVarName;
  }

  processProps(firstTokenStart) {
    const lineNumber = this.getLineNumberForIndex(firstTokenStart);
    const devProps = this.options.production
      ? ""
      : `__self: this, __source: {fileName: ${this.getFilenameVarName()}, lineNumber: ${lineNumber}}`;
    if (!this.tokens.matches1(_types.TokenType.jsxName) && !this.tokens.matches1(_types.TokenType.braceL)) {
      if (devProps) {
        this.tokens.appendCode(`, {${devProps}}`);
      } else {
        this.tokens.appendCode(`, null`);
      }
      return;
    }
    this.tokens.appendCode(`, {`);
    while (true) {
      if (this.tokens.matches2(_types.TokenType.jsxName, _types.TokenType.eq)) {
        this.processPropKeyName();
        this.tokens.replaceToken(": ");
        if (this.tokens.matches1(_types.TokenType.braceL)) {
          this.tokens.replaceToken("");
          this.rootTransformer.processBalancedCode();
          this.tokens.replaceToken("");
        } else if (this.tokens.matches1(_types.TokenType.jsxTagStart)) {
          this.processJSXTag();
        } else {
          this.processStringPropValue();
        }
      } else if (this.tokens.matches1(_types.TokenType.jsxName)) {
        this.processPropKeyName();
        this.tokens.appendCode(": true");
      } else if (this.tokens.matches1(_types.TokenType.braceL)) {
        this.tokens.replaceToken("");
        this.rootTransformer.processBalancedCode();
        this.tokens.replaceToken("");
      } else {
        break;
      }
      this.tokens.appendCode(",");
    }
    if (devProps) {
      this.tokens.appendCode(` ${devProps}}`);
    } else {
      this.tokens.appendCode("}");
    }
  }

  processPropKeyName() {
    const keyName = this.tokens.identifierName();
    if (keyName.includes("-")) {
      this.tokens.replaceToken(`'${keyName}'`);
    } else {
      this.tokens.copyToken();
    }
  }

  processStringPropValue() {
    const token = this.tokens.currentToken();
    const valueCode = this.tokens.code.slice(token.start + 1, token.end - 1);
    const replacementCode = formatJSXTextReplacement(valueCode);
    const literalCode = formatJSXStringValueLiteral(valueCode);
    this.tokens.replaceToken(literalCode + replacementCode);
  }

  /**
   * Process the first part of a tag, before any props.
   */
  processTagIntro() {
    // Walk forward until we see one of these patterns:
    // jsxName to start the first prop, preceded by another jsxName to end the tag name.
    // jsxName to start the first prop, preceded by greaterThan to end the type argument.
    // [open brace] to start the first prop.
    // [jsxTagEnd] to end the open-tag.
    // [slash, jsxTagEnd] to end the self-closing tag.
    let introEnd = this.tokens.currentIndex() + 1;
    while (
      this.tokens.tokens[introEnd].isType ||
      (!this.tokens.matches2AtIndex(introEnd - 1, _types.TokenType.jsxName, _types.TokenType.jsxName) &&
        !this.tokens.matches2AtIndex(introEnd - 1, _types.TokenType.greaterThan, _types.TokenType.jsxName) &&
        !this.tokens.matches1AtIndex(introEnd, _types.TokenType.braceL) &&
        !this.tokens.matches1AtIndex(introEnd, _types.TokenType.jsxTagEnd) &&
        !this.tokens.matches2AtIndex(introEnd, _types.TokenType.slash, _types.TokenType.jsxTagEnd))
    ) {
      introEnd++;
    }
    if (introEnd === this.tokens.currentIndex() + 1) {
      const tagName = this.tokens.identifierName();
      if (startsWithLowerCase(tagName)) {
        this.tokens.replaceToken(`'${tagName}'`);
      }
    }
    while (this.tokens.currentIndex() < introEnd) {
      this.rootTransformer.processToken();
    }
  }

  processChildren() {
    while (true) {
      if (this.tokens.matches2(_types.TokenType.jsxTagStart, _types.TokenType.slash)) {
        // Closing tag, so no more children.
        return;
      }
      if (this.tokens.matches1(_types.TokenType.braceL)) {
        if (this.tokens.matches2(_types.TokenType.braceL, _types.TokenType.braceR)) {
          // Empty interpolations and comment-only interpolations are allowed
          // and don't create an extra child arg.
          this.tokens.replaceToken("");
          this.tokens.replaceToken("");
        } else {
          // Interpolated expression.
          this.tokens.replaceToken(", ");
          this.rootTransformer.processBalancedCode();
          this.tokens.replaceToken("");
        }
      } else if (this.tokens.matches1(_types.TokenType.jsxTagStart)) {
        // Child JSX element
        this.tokens.appendCode(", ");
        this.processJSXTag();
      } else if (this.tokens.matches1(_types.TokenType.jsxText)) {
        this.processChildTextElement();
      } else {
        throw new Error("Unexpected token when processing JSX children.");
      }
    }
  }

  processChildTextElement() {
    const token = this.tokens.currentToken();
    const valueCode = this.tokens.code.slice(token.start, token.end);
    const replacementCode = formatJSXTextReplacement(valueCode);
    const literalCode = formatJSXTextLiteral(valueCode);
    if (literalCode === '""') {
      this.tokens.replaceToken(replacementCode);
    } else {
      this.tokens.replaceToken(`, ${literalCode}${replacementCode}`);
    }
  }

  processJSXTag() {
    const {jsxPragmaInfo} = this;
    const resolvedPragmaBaseName = this.importProcessor
      ? this.importProcessor.getIdentifierReplacement(jsxPragmaInfo.base) || jsxPragmaInfo.base
      : jsxPragmaInfo.base;
    const firstTokenStart = this.tokens.currentToken().start;
    // First tag is always jsxTagStart.
    this.tokens.replaceToken(`${resolvedPragmaBaseName}${jsxPragmaInfo.suffix}(`);

    if (this.tokens.matches1(_types.TokenType.jsxTagEnd)) {
      // Fragment syntax.
      const resolvedFragmentPragmaBaseName = this.importProcessor
        ? this.importProcessor.getIdentifierReplacement(jsxPragmaInfo.fragmentBase) ||
          jsxPragmaInfo.fragmentBase
        : jsxPragmaInfo.fragmentBase;
      this.tokens.replaceToken(
        `${resolvedFragmentPragmaBaseName}${jsxPragmaInfo.fragmentSuffix}, null`,
      );
      // Tag with children.
      this.processChildren();
      while (!this.tokens.matches1(_types.TokenType.jsxTagEnd)) {
        this.tokens.replaceToken("");
      }
      this.tokens.replaceToken(")");
    } else {
      // Normal open tag or self-closing tag.
      this.processTagIntro();
      this.processProps(firstTokenStart);

      if (this.tokens.matches2(_types.TokenType.slash, _types.TokenType.jsxTagEnd)) {
        // Self-closing tag.
        this.tokens.replaceToken("");
        this.tokens.replaceToken(")");
      } else if (this.tokens.matches1(_types.TokenType.jsxTagEnd)) {
        this.tokens.replaceToken("");
        // Tag with children.
        this.processChildren();
        while (!this.tokens.matches1(_types.TokenType.jsxTagEnd)) {
          this.tokens.replaceToken("");
        }
        this.tokens.replaceToken(")");
      } else {
        throw new Error("Expected either /> or > at the end of the tag.");
      }
    }
  }
} exports.default = JSXTransformer;

/**
 * Spec for identifiers: https://tc39.github.io/ecma262/#prod-IdentifierStart.
 *
 * Really only treat anything starting with a-z as tag names.  `_`, `$`, `é`
 * should be treated as copmonent names
 */
 function startsWithLowerCase(s) {
  const firstChar = s.charCodeAt(0);
  return firstChar >= _charcodes.charCodes.lowercaseA && firstChar <= _charcodes.charCodes.lowercaseZ;
} exports.startsWithLowerCase = startsWithLowerCase;

/**
 * Turn the given jsxText string into a JS string literal. Leading and trailing
 * whitespace on lines is removed, except immediately after the open-tag and
 * before the close-tag. Empty lines are completely removed, and spaces are
 * added between lines after that.
 *
 * We use JSON.stringify to introduce escape characters as necessary, and trim
 * the start and end of each line and remove blank lines.
 */
function formatJSXTextLiteral(text) {
  let result = "";
  let whitespace = "";

  let isInInitialLineWhitespace = false;
  let seenNonWhitespace = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\r") {
      if (!isInInitialLineWhitespace) {
        whitespace += c;
      }
    } else if (c === "\n") {
      whitespace = "";
      isInInitialLineWhitespace = true;
    } else {
      if (seenNonWhitespace && isInInitialLineWhitespace) {
        result += " ";
      }
      result += whitespace;
      whitespace = "";
      if (c === "&") {
        const {entity, newI} = processEntity(text, i + 1);
        i = newI - 1;
        result += entity;
      } else {
        result += c;
      }
      seenNonWhitespace = true;
      isInInitialLineWhitespace = false;
    }
  }
  if (!isInInitialLineWhitespace) {
    result += whitespace;
  }
  return JSON.stringify(result);
}

/**
 * Produce the code that should be printed after the JSX text string literal,
 * with most content removed, but all newlines preserved and all spacing at the
 * end preserved.
 */
function formatJSXTextReplacement(text) {
  let numNewlines = 0;
  let numSpaces = 0;
  for (const c of text) {
    if (c === "\n") {
      numNewlines++;
      numSpaces = 0;
    } else if (c === " ") {
      numSpaces++;
    }
  }
  return "\n".repeat(numNewlines) + " ".repeat(numSpaces);
}

/**
 * Format a string in the value position of a JSX prop.
 *
 * Use the same implementation as convertAttribute from
 * babel-helper-builder-react-jsx.
 */
function formatJSXStringValueLiteral(text) {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      if (/\s/.test(text[i + 1])) {
        result += " ";
        while (i < text.length && /\s/.test(text[i + 1])) {
          i++;
        }
      } else {
        result += "\n";
      }
    } else if (c === "&") {
      const {entity, newI} = processEntity(text, i + 1);
      result += entity;
      i = newI - 1;
    } else {
      result += c;
    }
  }
  return JSON.stringify(result);
}

/**
 * Starting at a &, see if there's an HTML entity (specified by name, decimal
 * char code, or hex char code) and return it if so.
 *
 * Modified from jsxReadString in babel-parser.
 */
function processEntity(text, indexAfterAmpersand) {
  let str = "";
  let count = 0;
  let entity;
  let i = indexAfterAmpersand;

  if (text[i] === "#") {
    let radix = 10;
    i++;
    let numStart;
    if (text[i] === "x") {
      radix = 16;
      i++;
      numStart = i;
      while (i < text.length && isHexDigit(text.charCodeAt(i))) {
        i++;
      }
    } else {
      numStart = i;
      while (i < text.length && isDecimalDigit(text.charCodeAt(i))) {
        i++;
      }
    }
    if (text[i] === ";") {
      const numStr = text.slice(numStart, i);
      if (numStr) {
        i++;
        entity = String.fromCodePoint(parseInt(numStr, radix));
      }
    }
  } else {
    while (i < text.length && count++ < 10) {
      const ch = text[i];
      i++;
      if (ch === ";") {
        entity = _xhtml2.default.get(str);
        break;
      }
      str += ch;
    }
  }

  if (!entity) {
    return {entity: "&", newI: indexAfterAmpersand};
  }
  return {entity, newI: i};
}

function isDecimalDigit(code) {
  return code >= _charcodes.charCodes.digit0 && code <= _charcodes.charCodes.digit9;
}

function isHexDigit(code) {
  return (
    (code >= _charcodes.charCodes.digit0 && code <= _charcodes.charCodes.digit9) ||
    (code >= _charcodes.charCodes.lowercaseA && code <= _charcodes.charCodes.lowercaseF) ||
    (code >= _charcodes.charCodes.uppercaseA && code <= _charcodes.charCodes.uppercaseF)
  );
}
