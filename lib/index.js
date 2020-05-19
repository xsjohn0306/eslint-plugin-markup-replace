'use strict'

const path = require('path')
const getSettings = require('./settings').getSettings

const BOM = "\uFEFF"
const GET_SCOPE_RULE_NAME = "__eslint-plugin-markup-replace-get-scope"
const DECLARE_VARIABLES_RULE_NAME = "__eslint-plugin-markup-replace-declare-variables"
const LINTER_ISPATCHED_PROPERTY_NAME =
  "__eslint-plugin-markup-replace-verify-function-is-patched"

function remapMessages(ctx, messages, code, settings) {
  var ms = []
  var startPosition = ctx.filtered[0].start.position
  var start
  for (var i = 0; i < messages[0].length; i++) {
    var message = messages[0][i]
    if (!start) {
      var position = getPosition(message, code.lineStartIndices)
      if (position > startPosition) {
        start = true
      }
    }
    if (start) {
      if (settings.removePHPLint) {
        var pos = getOriginalPosition(ctx, position)
        if (inPHPCode(ctx, pos)) {
          continue
        }
        if (message.fix && message.fix.range) {
          pos = getOriginalPosition(ctx, message.fix.range[0])
          if (inPHPCode(ctx, pos)) {
            continue
          }
        }
      }
      var loc = getOriginalLocation(ctx, message)
      message.line = loc.line
      message.column = loc.column

      // Map fix range
      if (message.fix && message.fix.range) {
        message.fix.range = [
          getOriginalPosition(ctx, message.fix.range[0]),
          // The range end is exclusive, meaning it should replace all characters with indexes from
          // start to end - 1. We have to get the original index of the last targeted character.
          getOriginalPosition(ctx, message.fix.range[1] - 1) + 1,
        ]
      }

      // Map end location
      if (message.endLine && message.endColumn) {
        loc = getOriginalLocation(ctx, {
          line: message.endLine,
          column: message.endColumn
        }, code.lineStartIndices)
        message.endLine = loc.line
        message.endColumn = loc.column
      }
    }
    ms.push(message)
  }
  if (settings.removePHPLint) {
    messages[0] = ms
  }
}

function getLineStartIndices(text) {
  return text.split('\n').map(s => s.length).reduce((prev, current) => {
    prev.push(prev[prev.length - 1] + current + 1)
    return prev
  }, [0])
}

function getLocation(position, lineStartIndices) {
  var i
  for (i = 1; i < lineStartIndices.length; i++) {
    if (position >= lineStartIndices[i - 1] && position < lineStartIndices[i]) {
      break
    }
  }
  return {
    line: i,
    column: position - lineStartIndices[i - 1] + 1
  }
}

function getPosition(loc, lineStartIndices) {
  return lineStartIndices[loc.line - 1] + loc.column - 1
}

function getOriginalPosition(ctx, position) {
  for (var i = 0; i < ctx.filtered.length; i++) {
    var f = ctx.filtered[i]
    if (position > f.start.position) {
      // remove the length of replaced text
      position = position + (f.end.position - f.start.position) - f.replacement.length
    }
  }
  return position
}

function getOriginalLocation(ctx, loc) {
  var position = getPosition(loc, ctx.code.lineStartIndices)
  for (var i = 0; i < ctx.filtered.length; i++) {
    var f = ctx.filtered[i]
    if (position > f.start.position) {
      // remove the length of replaced text
      position = position + (f.end.position - f.start.position) - f.replacement.length
    }
  }
  return getLocation(position, ctx.originalLineStartIndices)
}

function inPHPCode(ctx, position) {
  for (var i = 0; i < ctx.filtered.length; i++) {
    var f = ctx.filtered[i]
    if (position >= f.start.position && position < f.end.position) {
      return true
    }
  }
  return false
}

function isWhitespace(chr) {
  return chr === ' ' || chr === '\t'
}

function isNewline(text, pos) {
  return text[pos] === '\n' || text.substr(pos, 2) === '\r\n'
}

var _messages = []
var PHP_MARKUP = /<\?[\s\S]*?\?>/g
var PHP_MARKUP_EOL = /<\?[\s\S]*?\?>(\r?\n)?/g
var ctxIndex = -1
var processor = {
  preprocess: (text, filename, settings) => {
    if (typeof text === 'string') {
      var m, found = false, ms = []
      var filteredText = ''
      var originalLineStartIndices
      var customMarkupRegex = settings.customMarkupRegex
      var regex = (
        customMarkupRegex
          ? new RegExp(customMarkupRegex, 'g')
          : (settings.keepEOL ? PHP_MARKUP : PHP_MARKUP_EOL)
      )
      // reset match position
      regex.lastIndex = 0
      do {
        var lastIndex = regex.lastIndex
        m = regex.exec(text)
        if (m) {
          if (!found) {
            found = true
            originalLineStartIndices = getLineStartIndices(text)
          }
          var startPosition = m.index
          var markupText = text.substr(startPosition + 2, 1)
          var isEmptyLine = false
          if (settings.removeWhitespace || settings.removeEmptyLine) {
            while (startPosition > 0 && isWhitespace(text[startPosition - 1])) {
              startPosition--
            }
            if (startPosition === 0 || text[startPosition - 1] === '\n') {
              // empty whitespaces before php markup
              if (isNewline(text, settings.keepEOL ? regex.lastIndex : regex.lastIndex - 1)) {
                isEmptyLine = true
                m.index = startPosition
                if (settings.keepEOL && settings.removeEmptyLine) {
                  while (text[regex.lastIndex] !== '\n') {
                    regex.lastIndex++
                  }
                }
              }
            }
          }
          var startLoc = getLocation(m.index, originalLineStartIndices)
          startLoc.position = m.index
          var endLoc = getLocation(regex.lastIndex, originalLineStartIndices)
          endLoc.position = regex.lastIndex

          var replacement
          if (isEmptyLine && settings.removeEmptyLine) {
            replacement = ''
          } else {
            replacement = markupText === '='
              ? settings.markupReplacement['='] : settings.markupReplacement['php']
          }
          ms.push({
            start: startLoc,
            end: endLoc,
            replacement,
          })
          filteredText += text.substr(lastIndex, m.index - lastIndex) + replacement
        } else {
          filteredText += text.substr(lastIndex)
        }
      } while (m)
      ctxIndex++
      _messages.push({
        source: text,
        filtered: ms,
        code: { lineStartIndices: getLineStartIndices(filteredText) },
        originalLineStartIndices: originalLineStartIndices
      })
      return [filteredText]
    } else {
      _messages[ctxIndex].code = text
      return [text]
    }
  },
  postprocess: (messages, filename, settings, hasBOM) => {
    if (ctxIndex >= 0 && _messages[ctxIndex].filtered.length > 0) {
      var m = _messages[ctxIndex]
      remapMessages(m, messages, m.code, settings)
    }
    return messages[0]
  },
  supportsAutofix: true
}

// Monkey patch for `Linter.prototype.verify`
// Inspired by [eslint-plugin-html](https://github.com/BenoitZugmeyer/eslint-plugin-html)
const needles = [
  path.join("lib", "linter", "linter.js"), // ESLint 6+
  path.join("lib", "linter.js"), // ESLint 5-
]

iterateESLintModules(patch)

function getLinterFromModule(moduleExports) {
  return moduleExports.Linter
    ? moduleExports.Linter // ESLint 6+
    : moduleExports // ESLint 5-
}

function getModuleFromRequire() {
  return getLinterFromModule(require("eslint/lib/linter"))
}

function getModuleFromCache(key) {
  if (!needles.some(needle => key.endsWith(needle))) return

  const module = require.cache[key]
  if (!module || !module.exports) return

  const Linter = getLinterFromModule(module.exports)
  if (
    typeof Linter === "function" &&
    typeof Linter.prototype.verify === "function"
  ) {
    return Linter
  }
}

function iterateESLintModules(fn) {
  if (!require.cache || Object.keys(require.cache).length === 0) {
    // Jest is replacing the node "require" function, and "require.cache" isn't available here.
    fn(getModuleFromRequire())
    return
  }

  let found = false

  for (const key in require.cache) {
    const Linter = getModuleFromCache(key)
    if (Linter) {
      fn(Linter)
      found = true
    }
  }

  if (!found) {
    let eslintPath, eslintVersion
    try {
      eslintPath = require.resolve("eslint")
    } catch (e) {
      eslintPath = "(not found)"
    }
    try {
      eslintVersion = require("eslint/package.json").version
    } catch (e) {
      eslintVersion = "n/a"
    }

    const parentPaths = module =>
      module ? [module.filename].concat(parentPaths(module.parent)) : []

    throw new Error(
      `eslint-plugin-markup-replace error: It seems that eslint is not loaded.
If you think this is a bug, please file a report at https://github.com/xsjohn0306/eslint-plugin-markup-replace/issues

In the report, please include *all* those informations:

* ESLint version: ${eslintVersion}
* ESLint path: ${eslintPath}
* Plugin version: ${require("../package.json").version}
* Plugin inclusion paths: ${parentPaths(module).join(", ")}
* NodeJS version: ${process.version}
* CLI arguments: ${JSON.stringify(process.argv)}
* Content of your lock file (package-lock.json or yarn.lock) or the output of \`npm list\`
* How did you run ESLint (via the command line? an editor plugin?)
* The following stack trace:
    ${new Error().stack.slice(10)}


      `
    )
  }
}

function patch(Linter) {
  const verifyMethodName = Linter.prototype._verifyWithoutProcessors
    ? "_verifyWithoutProcessors" // ESLint 6+
    : "verify" // ESLint 5-
  const verify = Linter.prototype[verifyMethodName]

  // ignore if verify function is already been patched sometime before
  if (Linter[LINTER_ISPATCHED_PROPERTY_NAME] === true) {
    return
  }
  Linter[LINTER_ISPATCHED_PROPERTY_NAME] = true
  Linter.prototype[verifyMethodName] = function(
    textOrSourceCode,
    config,
    filenameOrOptions,
    saveState
  ) {
    const localVerify = code =>
      verify.call(this, code, config, filenameOrOptions, saveState)

    let messages
    const filename =
      typeof filenameOrOptions === "object"
        ? filenameOrOptions.filename
        : filenameOrOptions
    const extension = path.extname(filename || "")

    const pluginSettings = getSettings(config.settings || {})
    const isPHP = pluginSettings.phpExtensions.indexOf(extension) >= 0

    if (isPHP) {
      messages = []

      const pushMessages = (localMessages, code) => {
        messages.push.apply(
          messages,
          processor.postprocess([localMessages], code, pluginSettings, false) //textOrSourceCode.startsWith(BOM))
        )
      }

      const currentCodes = processor.preprocess(textOrSourceCode, filename, pluginSettings)

      for (const code of currentCodes) {
        pushMessages(localVerify(code), code)
      }

      messages.sort((ma, mb) => {
        return ma.line - mb.line || ma.column - mb.column
      })
    } else {
      messages = localVerify(textOrSourceCode)
    }

    return messages
  }
}
