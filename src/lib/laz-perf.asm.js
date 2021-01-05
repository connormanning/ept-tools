var Module = typeof Module !== 'undefined' ? Module : {}
var moduleOverrides = {}
var key
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key]
  }
}
Module['arguments'] = []
Module['thisProgram'] = './this.program'
Module['quit'] = function (status, toThrow) {
  throw toThrow
}
Module['preRun'] = []
Module['postRun'] = []
var ENVIRONMENT_IS_WEB = false
var ENVIRONMENT_IS_WORKER = false
var ENVIRONMENT_IS_NODE = false
var ENVIRONMENT_HAS_NODE = false
var ENVIRONMENT_IS_SHELL = false
ENVIRONMENT_IS_WEB = typeof window === 'object'
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function'
ENVIRONMENT_HAS_NODE =
  typeof process === 'object' && typeof require === 'function'
ENVIRONMENT_IS_NODE =
  ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER
ENVIRONMENT_IS_SHELL =
  !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER
var scriptDirectory = ''
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory)
  } else {
    return scriptDirectory + path
  }
}
if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/'
  var nodeFS
  var nodePath
  Module['read'] = function shell_read(filename, binary) {
    var ret
    if (!nodeFS) nodeFS = require('fs')
    if (!nodePath) nodePath = require('path')
    filename = nodePath['normalize'](filename)
    ret = nodeFS['readFileSync'](filename)
    return binary ? ret : ret.toString()
  }
  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true)
    if (!ret.buffer) {
      ret = new Uint8Array(ret)
    }
    assert(ret.buffer)
    return ret
  }
  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/')
  }
  Module['arguments'] = process['argv'].slice(2)
  if (typeof module !== 'undefined') {
    module['exports'] = Module
  }
  process['on']('uncaughtException', function (ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex
    }
  })
  process['on']('unhandledRejection', abort)
  Module['quit'] = function (status) {
    process['exit'](status)
  }
  Module['inspect'] = function () {
    return '[Emscripten Module object]'
  }
} else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f)
    }
  }
  Module['readBinary'] = function readBinary(f) {
    var data
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f))
    }
    data = read(f, 'binary')
    assert(typeof data === 'object')
    return data
  }
  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments
  }
  if (typeof quit === 'function') {
    Module['quit'] = function (status) {
      quit(status)
    }
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = self.location.href
  } else if (document.currentScript) {
    scriptDirectory = document.currentScript.src
  }
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(
      0,
      scriptDirectory.lastIndexOf('/') + 1
    )
  } else {
    scriptDirectory = ''
  }
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', url, false)
    xhr.send(null)
    return xhr.responseText
  }
  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest()
      xhr.open('GET', url, false)
      xhr.responseType = 'arraybuffer'
      xhr.send(null)
      return new Uint8Array(xhr.response)
    }
  }
  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
        onload(xhr.response)
        return
      }
      onerror()
    }
    xhr.onerror = onerror
    xhr.send(null)
  }
  Module['setWindowTitle'] = function (title) {
    document.title = title
  }
} else {
}
var out =
  Module['print'] ||
  (typeof console !== 'undefined'
    ? console.log.bind(console)
    : typeof print !== 'undefined'
    ? print
    : null)
var err =
  Module['printErr'] ||
  (typeof printErr !== 'undefined'
    ? printErr
    : (typeof console !== 'undefined' && console.warn.bind(console)) || out)
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key]
  }
}
moduleOverrides = undefined
var STACK_ALIGN = 16
function dynamicAlloc(size) {
  var ret = HEAP32[DYNAMICTOP_PTR >> 2]
  var end = (ret + size + 15) & -16
  if (end > _emscripten_get_heap_size()) {
    abort()
  }
  HEAP32[DYNAMICTOP_PTR >> 2] = end
  return ret
}
function getNativeTypeSize(type) {
  switch (type) {
    case 'i1':
    case 'i8':
      return 1
    case 'i16':
      return 2
    case 'i32':
      return 4
    case 'i64':
      return 8
    case 'float':
      return 4
    case 'double':
      return 8
    default: {
      if (type[type.length - 1] === '*') {
        return 4
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1))
        assert(
          bits % 8 === 0,
          'getNativeTypeSize invalid bits ' + bits + ', type ' + type
        )
        return bits / 8
      } else {
        return 0
      }
    }
  }
}
function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {}
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1
    err(text)
  }
}
var jsCallStartIndex = 1
var functionPointers = new Array(0)
var funcWrappers = {}
function dynCall(sig, ptr, args) {
  if (args && args.length) {
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args))
  } else {
    return Module['dynCall_' + sig].call(null, ptr)
  }
}
var tempRet0 = 0
var setTempRet0 = function (value) {
  tempRet0 = value
}
var getTempRet0 = function () {
  return tempRet0
}
var GLOBAL_BASE = 8
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8'
  if (type.charAt(type.length - 1) === '*') type = 'i32'
  switch (type) {
    case 'i1':
      HEAP8[ptr >> 0] = value
      break
    case 'i8':
      HEAP8[ptr >> 0] = value
      break
    case 'i16':
      HEAP16[ptr >> 1] = value
      break
    case 'i32':
      HEAP32[ptr >> 2] = value
      break
    case 'i64':
      ;(tempI64 = [
        value >>> 0,
        ((tempDouble = value),
        +Math_abs(tempDouble) >= +1
          ? tempDouble > +0
            ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / +4294967296
              ) >>> 0
          : 0),
      ]),
        (HEAP32[ptr >> 2] = tempI64[0]),
        (HEAP32[(ptr + 4) >> 2] = tempI64[1])
      break
    case 'float':
      HEAPF32[ptr >> 2] = value
      break
    case 'double':
      HEAPF64[ptr >> 3] = value
      break
    default:
      abort('invalid type for setValue: ' + type)
  }
}
var ABORT = false
var EXITSTATUS = 0
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text)
  }
}
function getCFunc(ident) {
  var func = Module['_' + ident]
  assert(
    func,
    'Cannot call unknown function ' + ident + ', make sure it is exported'
  )
  return func
}
function ccall(ident, returnType, argTypes, args, opts) {
  var toC = {
    string: function (str) {
      var ret = 0
      if (str !== null && str !== undefined && str !== 0) {
        var len = (str.length << 2) + 1
        ret = stackAlloc(len)
        stringToUTF8(str, ret, len)
      }
      return ret
    },
    array: function (arr) {
      var ret = stackAlloc(arr.length)
      writeArrayToMemory(arr, ret)
      return ret
    },
  }
  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret)
    if (returnType === 'boolean') return Boolean(ret)
    return ret
  }
  var func = getCFunc(ident)
  var cArgs = []
  var stack = 0
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]]
      if (converter) {
        if (stack === 0) stack = stackSave()
        cArgs[i] = converter(args[i])
      } else {
        cArgs[i] = args[i]
      }
    }
  }
  var ret = func.apply(null, cArgs)
  ret = convertReturnValue(ret)
  if (stack !== 0) stackRestore(stack)
  return ret
}
var ALLOC_NONE = 3
var UTF8Decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead
  var endPtr = idx
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr
  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
  } else {
    var str = ''
    while (idx < endPtr) {
      var u0 = u8Array[idx++]
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0)
        continue
      }
      var u1 = u8Array[idx++] & 63
      if ((u0 & 224) == 192) {
        str += String.fromCharCode(((u0 & 31) << 6) | u1)
        continue
      }
      var u2 = u8Array[idx++] & 63
      if ((u0 & 240) == 224) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2
      } else {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63)
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0)
      } else {
        var ch = u0 - 65536
        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023))
      }
    }
  }
  return str
}
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ''
}
function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0
  var startIdx = outIdx
  var endIdx = outIdx + maxBytesToWrite - 1
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i)
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i)
      u = (65536 + ((u & 1023) << 10)) | (u1 & 1023)
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break
      outU8Array[outIdx++] = u
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break
      outU8Array[outIdx++] = 192 | (u >> 6)
      outU8Array[outIdx++] = 128 | (u & 63)
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break
      outU8Array[outIdx++] = 224 | (u >> 12)
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63)
      outU8Array[outIdx++] = 128 | (u & 63)
    } else {
      if (outIdx + 3 >= endIdx) break
      outU8Array[outIdx++] = 240 | (u >> 18)
      outU8Array[outIdx++] = 128 | ((u >> 12) & 63)
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63)
      outU8Array[outIdx++] = 128 | (u & 63)
    }
  }
  outU8Array[outIdx] = 0
  return outIdx - startIdx
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}
function lengthBytesUTF8(str) {
  var len = 0
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i)
    if (u >= 55296 && u <= 57343)
      u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023)
    if (u <= 127) ++len
    else if (u <= 2047) len += 2
    else if (u <= 65535) len += 3
    else len += 4
  }
  return len
}
var UTF16Decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined
function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer)
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++ >> 0] = str.charCodeAt(i)
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0
}
function demangle(func) {
  return func
}
function demangleAll(text) {
  var regex = /__Z[\w\d_]+/g
  return text.replace(regex, function (x) {
    var y = demangle(x)
    return x === y ? x : y + ' [' + x + ']'
  })
}
function jsStackTrace() {
  var err = new Error()
  if (!err.stack) {
    try {
      throw new Error(0)
    } catch (e) {
      err = e
    }
    if (!err.stack) {
      return '(no stack trace available)'
    }
  }
  return err.stack.toString()
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64
function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer)
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer)
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer)
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer)
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer)
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer)
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer)
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer)
}
var STACK_BASE = 19616,
  DYNAMIC_BASE = 5262496,
  DYNAMICTOP_PTR = 19584
var TOTAL_STACK = 5242880
var INITIAL_TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 167772160
if (INITIAL_TOTAL_MEMORY < TOTAL_STACK)
  err(
    'TOTAL_MEMORY should be larger than TOTAL_STACK, was ' +
      INITIAL_TOTAL_MEMORY +
      '! (TOTAL_STACK=' +
      TOTAL_STACK +
      ')'
  )
if (Module['buffer']) {
  buffer = Module['buffer']
} else {
  {
    buffer = new ArrayBuffer(INITIAL_TOTAL_MEMORY)
  }
}
updateGlobalBufferViews()
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE
function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift()
    if (typeof callback == 'function') {
      callback()
      continue
    }
    var func = callback.func
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func)
      } else {
        Module['dynCall_vi'](func, callback.arg)
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg)
    }
  }
}
var __ATPRERUN__ = []
var __ATINIT__ = []
var __ATMAIN__ = []
var __ATPOSTRUN__ = []
var runtimeInitialized = false
var runtimeExited = false
function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function')
      Module['preRun'] = [Module['preRun']]
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift())
    }
  }
  callRuntimeCallbacks(__ATPRERUN__)
}
function initRuntime() {
  runtimeInitialized = true
  callRuntimeCallbacks(__ATINIT__)
}
function preMain() {
  callRuntimeCallbacks(__ATMAIN__)
}
function exitRuntime() {
  runtimeExited = true
}
function postRun() {
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function')
      Module['postRun'] = [Module['postRun']]
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift())
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__)
}
function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb)
}
function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb)
}
var Math_abs = Math.abs
var Math_ceil = Math.ceil
var Math_floor = Math.floor
var Math_min = Math.min
var runDependencies = 0
var runDependencyWatcher = null
var dependenciesFulfilled = null
function addRunDependency(id) {
  runDependencies++
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies)
  }
}
function removeRunDependency(id) {
  runDependencies--
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies)
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher)
      runDependencyWatcher = null
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled
      dependenciesFulfilled = null
      callback()
    }
  }
}
Module['preloadedImages'] = {}
Module['preloadedAudios'] = {}
var memoryInitializer = null
var dataURIPrefix = 'data:application/octet-stream;base64,'
function isDataURI(filename) {
  return String.prototype.startsWith
    ? filename.startsWith(dataURIPrefix)
    : filename.indexOf(dataURIPrefix) === 0
}
__ATINIT__.push({
  func: function () {
    globalCtors()
  },
})
memoryInitializer = 'laz-perf.asm.js.mem'
var tempDoublePtr = 19600
function ___cxa_allocate_exception(size) {
  return _malloc(size)
}
var ___exception_infos = {}
var ___exception_caught = []
function ___exception_addRef(ptr) {
  if (!ptr) return
  var info = ___exception_infos[ptr]
  info.refcount++
}
function ___exception_deAdjust(adjusted) {
  if (!adjusted || ___exception_infos[adjusted]) return adjusted
  for (var key in ___exception_infos) {
    var ptr = +key
    var adj = ___exception_infos[ptr].adjusted
    var len = adj.length
    for (var i = 0; i < len; i++) {
      if (adj[i] === adjusted) {
        return ptr
      }
    }
  }
  return adjusted
}
function ___cxa_begin_catch(ptr) {
  var info = ___exception_infos[ptr]
  if (info && !info.caught) {
    info.caught = true
    __ZSt18uncaught_exceptionv.uncaught_exception--
  }
  if (info) info.rethrown = false
  ___exception_caught.push(ptr)
  ___exception_addRef(___exception_deAdjust(ptr))
  return ptr
}
var ___exception_last = 0
function ___cxa_throw(ptr, type, destructor) {
  ___exception_infos[ptr] = {
    ptr: ptr,
    adjusted: [ptr],
    type: type,
    destructor: destructor,
    refcount: 0,
    caught: false,
    rethrown: false,
  }
  ___exception_last = ptr
  if (!('uncaught_exception' in __ZSt18uncaught_exceptionv)) {
    __ZSt18uncaught_exceptionv.uncaught_exception = 1
  } else {
    __ZSt18uncaught_exceptionv.uncaught_exception++
  }
  throw ptr
}
function ___cxa_uncaught_exception() {
  return !!__ZSt18uncaught_exceptionv.uncaught_exception
}
function ___gxx_personality_v0() {}
var PATH = {
  splitPath: function (filename) {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/
    return splitPathRe.exec(filename).slice(1)
  },
  normalizeArray: function (parts, allowAboveRoot) {
    var up = 0
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i]
      if (last === '.') {
        parts.splice(i, 1)
      } else if (last === '..') {
        parts.splice(i, 1)
        up++
      } else if (up) {
        parts.splice(i, 1)
        up--
      }
    }
    if (allowAboveRoot) {
      for (; up; up--) {
        parts.unshift('..')
      }
    }
    return parts
  },
  normalize: function (path) {
    var isAbsolute = path.charAt(0) === '/',
      trailingSlash = path.substr(-1) === '/'
    path = PATH.normalizeArray(
      path.split('/').filter(function (p) {
        return !!p
      }),
      !isAbsolute
    ).join('/')
    if (!path && !isAbsolute) {
      path = '.'
    }
    if (path && trailingSlash) {
      path += '/'
    }
    return (isAbsolute ? '/' : '') + path
  },
  dirname: function (path) {
    var result = PATH.splitPath(path),
      root = result[0],
      dir = result[1]
    if (!root && !dir) {
      return '.'
    }
    if (dir) {
      dir = dir.substr(0, dir.length - 1)
    }
    return root + dir
  },
  basename: function (path) {
    if (path === '/') return '/'
    var lastSlash = path.lastIndexOf('/')
    if (lastSlash === -1) return path
    return path.substr(lastSlash + 1)
  },
  extname: function (path) {
    return PATH.splitPath(path)[3]
  },
  join: function () {
    var paths = Array.prototype.slice.call(arguments, 0)
    return PATH.normalize(paths.join('/'))
  },
  join2: function (l, r) {
    return PATH.normalize(l + '/' + r)
  },
}
var SYSCALLS = {
  buffers: [null, [], []],
  printChar: function (stream, curr) {
    var buffer = SYSCALLS.buffers[stream]
    if (curr === 0 || curr === 10) {
      ;(stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0))
      buffer.length = 0
    } else {
      buffer.push(curr)
    }
  },
  varargs: 0,
  get: function (varargs) {
    SYSCALLS.varargs += 4
    var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2]
    return ret
  },
  getStr: function () {
    var ret = UTF8ToString(SYSCALLS.get())
    return ret
  },
  get64: function () {
    var low = SYSCALLS.get(),
      high = SYSCALLS.get()
    return low
  },
  getZero: function () {
    SYSCALLS.get()
  },
}
function ___syscall140(which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      offset_high = SYSCALLS.get(),
      offset_low = SYSCALLS.get(),
      result = SYSCALLS.get(),
      whence = SYSCALLS.get()
    return 0
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function flush_NO_FILESYSTEM() {
  var fflush = Module['_fflush']
  if (fflush) fflush(0)
  var buffers = SYSCALLS.buffers
  if (buffers[1].length) SYSCALLS.printChar(1, 10)
  if (buffers[2].length) SYSCALLS.printChar(2, 10)
}
function ___syscall146(which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var stream = SYSCALLS.get(),
      iov = SYSCALLS.get(),
      iovcnt = SYSCALLS.get()
    var ret = 0
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[(iov + i * 8) >> 2]
      var len = HEAP32[(iov + (i * 8 + 4)) >> 2]
      for (var j = 0; j < len; j++) {
        SYSCALLS.printChar(stream, HEAPU8[ptr + j])
      }
      ret += len
    }
    return ret
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall6(which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var stream = SYSCALLS.getStreamFromFD()
    return 0
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function getShiftFromSize(size) {
  switch (size) {
    case 1:
      return 0
    case 2:
      return 1
    case 4:
      return 2
    case 8:
      return 3
    default:
      throw new TypeError('Unknown type size: ' + size)
  }
}
function embind_init_charCodes() {
  var codes = new Array(256)
  for (var i = 0; i < 256; ++i) {
    codes[i] = String.fromCharCode(i)
  }
  embind_charCodes = codes
}
var embind_charCodes = undefined
function readLatin1String(ptr) {
  var ret = ''
  var c = ptr
  while (HEAPU8[c]) {
    ret += embind_charCodes[HEAPU8[c++]]
  }
  return ret
}
var awaitingDependencies = {}
var registeredTypes = {}
var typeDependencies = {}
var char_0 = 48
var char_9 = 57
function makeLegalFunctionName(name) {
  if (undefined === name) {
    return '_unknown'
  }
  name = name.replace(/[^a-zA-Z0-9_]/g, '$')
  var f = name.charCodeAt(0)
  if (f >= char_0 && f <= char_9) {
    return '_' + name
  } else {
    return name
  }
}
function createNamedFunction(name, body) {
  name = makeLegalFunctionName(name)
  return new Function(
    'body',
    'return function ' +
      name +
      '() {\n' +
      '    "use strict";' +
      '    return body.apply(this, arguments);\n' +
      '};\n'
  )(body)
}
function extendError(baseErrorType, errorName) {
  var errorClass = createNamedFunction(errorName, function (message) {
    this.name = errorName
    this.message = message
    var stack = new Error(message).stack
    if (stack !== undefined) {
      this.stack =
        this.toString() + '\n' + stack.replace(/^Error(:[^\n]*)?\n/, '')
    }
  })
  errorClass.prototype = Object.create(baseErrorType.prototype)
  errorClass.prototype.constructor = errorClass
  errorClass.prototype.toString = function () {
    if (this.message === undefined) {
      return this.name
    } else {
      return this.name + ': ' + this.message
    }
  }
  return errorClass
}
var BindingError = undefined
function throwBindingError(message) {
  throw new BindingError(message)
}
var InternalError = undefined
function throwInternalError(message) {
  throw new InternalError(message)
}
function whenDependentTypesAreResolved(
  myTypes,
  dependentTypes,
  getTypeConverters
) {
  myTypes.forEach(function (type) {
    typeDependencies[type] = dependentTypes
  })
  function onComplete(typeConverters) {
    var myTypeConverters = getTypeConverters(typeConverters)
    if (myTypeConverters.length !== myTypes.length) {
      throwInternalError('Mismatched type converter count')
    }
    for (var i = 0; i < myTypes.length; ++i) {
      registerType(myTypes[i], myTypeConverters[i])
    }
  }
  var typeConverters = new Array(dependentTypes.length)
  var unregisteredTypes = []
  var registered = 0
  dependentTypes.forEach(function (dt, i) {
    if (registeredTypes.hasOwnProperty(dt)) {
      typeConverters[i] = registeredTypes[dt]
    } else {
      unregisteredTypes.push(dt)
      if (!awaitingDependencies.hasOwnProperty(dt)) {
        awaitingDependencies[dt] = []
      }
      awaitingDependencies[dt].push(function () {
        typeConverters[i] = registeredTypes[dt]
        ++registered
        if (registered === unregisteredTypes.length) {
          onComplete(typeConverters)
        }
      })
    }
  })
  if (0 === unregisteredTypes.length) {
    onComplete(typeConverters)
  }
}
function registerType(rawType, registeredInstance, options) {
  options = options || {}
  if (!('argPackAdvance' in registeredInstance)) {
    throw new TypeError(
      'registerType registeredInstance requires argPackAdvance'
    )
  }
  var name = registeredInstance.name
  if (!rawType) {
    throwBindingError(
      'type "' + name + '" must have a positive integer typeid pointer'
    )
  }
  if (registeredTypes.hasOwnProperty(rawType)) {
    if (options.ignoreDuplicateRegistrations) {
      return
    } else {
      throwBindingError("Cannot register type '" + name + "' twice")
    }
  }
  registeredTypes[rawType] = registeredInstance
  delete typeDependencies[rawType]
  if (awaitingDependencies.hasOwnProperty(rawType)) {
    var callbacks = awaitingDependencies[rawType]
    delete awaitingDependencies[rawType]
    callbacks.forEach(function (cb) {
      cb()
    })
  }
}
function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
  var shift = getShiftFromSize(size)
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function (wt) {
      return !!wt
    },
    toWireType: function (destructors, o) {
      return o ? trueValue : falseValue
    },
    argPackAdvance: 8,
    readValueFromPointer: function (pointer) {
      var heap
      if (size === 1) {
        heap = HEAP8
      } else if (size === 2) {
        heap = HEAP16
      } else if (size === 4) {
        heap = HEAP32
      } else {
        throw new TypeError('Unknown boolean type size: ' + name)
      }
      return this['fromWireType'](heap[pointer >> shift])
    },
    destructorFunction: null,
  })
}
function ClassHandle_isAliasOf(other) {
  if (!(this instanceof ClassHandle)) {
    return false
  }
  if (!(other instanceof ClassHandle)) {
    return false
  }
  var leftClass = this.$$.ptrType.registeredClass
  var left = this.$$.ptr
  var rightClass = other.$$.ptrType.registeredClass
  var right = other.$$.ptr
  while (leftClass.baseClass) {
    left = leftClass.upcast(left)
    leftClass = leftClass.baseClass
  }
  while (rightClass.baseClass) {
    right = rightClass.upcast(right)
    rightClass = rightClass.baseClass
  }
  return leftClass === rightClass && left === right
}
function shallowCopyInternalPointer(o) {
  return {
    count: o.count,
    deleteScheduled: o.deleteScheduled,
    preservePointerOnDelete: o.preservePointerOnDelete,
    ptr: o.ptr,
    ptrType: o.ptrType,
    smartPtr: o.smartPtr,
    smartPtrType: o.smartPtrType,
  }
}
function throwInstanceAlreadyDeleted(obj) {
  function getInstanceTypeName(handle) {
    return handle.$$.ptrType.registeredClass.name
  }
  throwBindingError(getInstanceTypeName(obj) + ' instance already deleted')
}
var finalizationGroup = false
function detachFinalizer(handle) {}
function runDestructor($$) {
  if ($$.smartPtr) {
    $$.smartPtrType.rawDestructor($$.smartPtr)
  } else {
    $$.ptrType.registeredClass.rawDestructor($$.ptr)
  }
}
function releaseClassHandle($$) {
  $$.count.value -= 1
  var toDelete = 0 === $$.count.value
  if (toDelete) {
    runDestructor($$)
  }
}
function attachFinalizer(handle) {
  if ('undefined' === typeof FinalizationGroup) {
    attachFinalizer = function (handle) {
      return handle
    }
    return handle
  }
  finalizationGroup = new FinalizationGroup(function (iter) {
    for (var result = iter.next(); !result.done; result = iter.next()) {
      var $$ = result.value
      if (!$$.ptr) {
        console.warn('object already deleted: ' + $$.ptr)
      } else {
        releaseClassHandle($$)
      }
    }
  })
  attachFinalizer = function (handle) {
    finalizationGroup.register(handle, handle.$$, handle.$$)
    return handle
  }
  detachFinalizer = function (handle) {
    finalizationGroup.unregister(handle.$$)
  }
  return attachFinalizer(handle)
}
function ClassHandle_clone() {
  if (!this.$$.ptr) {
    throwInstanceAlreadyDeleted(this)
  }
  if (this.$$.preservePointerOnDelete) {
    this.$$.count.value += 1
    return this
  } else {
    var clone = attachFinalizer(
      Object.create(Object.getPrototypeOf(this), {
        $$: { value: shallowCopyInternalPointer(this.$$) },
      })
    )
    clone.$$.count.value += 1
    clone.$$.deleteScheduled = false
    return clone
  }
}
function ClassHandle_delete() {
  if (!this.$$.ptr) {
    throwInstanceAlreadyDeleted(this)
  }
  if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
    throwBindingError('Object already scheduled for deletion')
  }
  detachFinalizer(this)
  releaseClassHandle(this.$$)
  if (!this.$$.preservePointerOnDelete) {
    this.$$.smartPtr = undefined
    this.$$.ptr = undefined
  }
}
function ClassHandle_isDeleted() {
  return !this.$$.ptr
}
var delayFunction = undefined
var deletionQueue = []
function flushPendingDeletes() {
  while (deletionQueue.length) {
    var obj = deletionQueue.pop()
    obj.$$.deleteScheduled = false
    obj['delete']()
  }
}
function ClassHandle_deleteLater() {
  if (!this.$$.ptr) {
    throwInstanceAlreadyDeleted(this)
  }
  if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
    throwBindingError('Object already scheduled for deletion')
  }
  deletionQueue.push(this)
  if (deletionQueue.length === 1 && delayFunction) {
    delayFunction(flushPendingDeletes)
  }
  this.$$.deleteScheduled = true
  return this
}
function init_ClassHandle() {
  ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf
  ClassHandle.prototype['clone'] = ClassHandle_clone
  ClassHandle.prototype['delete'] = ClassHandle_delete
  ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted
  ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater
}
function ClassHandle() {}
var registeredPointers = {}
function ensureOverloadTable(proto, methodName, humanName) {
  if (undefined === proto[methodName].overloadTable) {
    var prevFunc = proto[methodName]
    proto[methodName] = function () {
      if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
        throwBindingError(
          "Function '" +
            humanName +
            "' called with an invalid number of arguments (" +
            arguments.length +
            ') - expects one of (' +
            proto[methodName].overloadTable +
            ')!'
        )
      }
      return proto[methodName].overloadTable[arguments.length].apply(
        this,
        arguments
      )
    }
    proto[methodName].overloadTable = []
    proto[methodName].overloadTable[prevFunc.argCount] = prevFunc
  }
}
function exposePublicSymbol(name, value, numArguments) {
  if (Module.hasOwnProperty(name)) {
    if (
      undefined === numArguments ||
      (undefined !== Module[name].overloadTable &&
        undefined !== Module[name].overloadTable[numArguments])
    ) {
      throwBindingError("Cannot register public name '" + name + "' twice")
    }
    ensureOverloadTable(Module, name, name)
    if (Module.hasOwnProperty(numArguments)) {
      throwBindingError(
        'Cannot register multiple overloads of a function with the same number of arguments (' +
          numArguments +
          ')!'
      )
    }
    Module[name].overloadTable[numArguments] = value
  } else {
    Module[name] = value
    if (undefined !== numArguments) {
      Module[name].numArguments = numArguments
    }
  }
}
function RegisteredClass(
  name,
  constructor,
  instancePrototype,
  rawDestructor,
  baseClass,
  getActualType,
  upcast,
  downcast
) {
  this.name = name
  this.constructor = constructor
  this.instancePrototype = instancePrototype
  this.rawDestructor = rawDestructor
  this.baseClass = baseClass
  this.getActualType = getActualType
  this.upcast = upcast
  this.downcast = downcast
  this.pureVirtualFunctions = []
}
function upcastPointer(ptr, ptrClass, desiredClass) {
  while (ptrClass !== desiredClass) {
    if (!ptrClass.upcast) {
      throwBindingError(
        'Expected null or instance of ' +
          desiredClass.name +
          ', got an instance of ' +
          ptrClass.name
      )
    }
    ptr = ptrClass.upcast(ptr)
    ptrClass = ptrClass.baseClass
  }
  return ptr
}
function constNoSmartPtrRawPointerToWireType(destructors, handle) {
  if (handle === null) {
    if (this.isReference) {
      throwBindingError('null is not a valid ' + this.name)
    }
    return 0
  }
  if (!handle.$$) {
    throwBindingError(
      'Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name
    )
  }
  if (!handle.$$.ptr) {
    throwBindingError(
      'Cannot pass deleted object as a pointer of type ' + this.name
    )
  }
  var handleClass = handle.$$.ptrType.registeredClass
  var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass)
  return ptr
}
function genericPointerToWireType(destructors, handle) {
  var ptr
  if (handle === null) {
    if (this.isReference) {
      throwBindingError('null is not a valid ' + this.name)
    }
    if (this.isSmartPointer) {
      ptr = this.rawConstructor()
      if (destructors !== null) {
        destructors.push(this.rawDestructor, ptr)
      }
      return ptr
    } else {
      return 0
    }
  }
  if (!handle.$$) {
    throwBindingError(
      'Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name
    )
  }
  if (!handle.$$.ptr) {
    throwBindingError(
      'Cannot pass deleted object as a pointer of type ' + this.name
    )
  }
  if (!this.isConst && handle.$$.ptrType.isConst) {
    throwBindingError(
      'Cannot convert argument of type ' +
        (handle.$$.smartPtrType
          ? handle.$$.smartPtrType.name
          : handle.$$.ptrType.name) +
        ' to parameter type ' +
        this.name
    )
  }
  var handleClass = handle.$$.ptrType.registeredClass
  ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass)
  if (this.isSmartPointer) {
    if (undefined === handle.$$.smartPtr) {
      throwBindingError('Passing raw pointer to smart pointer is illegal')
    }
    switch (this.sharingPolicy) {
      case 0:
        if (handle.$$.smartPtrType === this) {
          ptr = handle.$$.smartPtr
        } else {
          throwBindingError(
            'Cannot convert argument of type ' +
              (handle.$$.smartPtrType
                ? handle.$$.smartPtrType.name
                : handle.$$.ptrType.name) +
              ' to parameter type ' +
              this.name
          )
        }
        break
      case 1:
        ptr = handle.$$.smartPtr
        break
      case 2:
        if (handle.$$.smartPtrType === this) {
          ptr = handle.$$.smartPtr
        } else {
          var clonedHandle = handle['clone']()
          ptr = this.rawShare(
            ptr,
            __emval_register(function () {
              clonedHandle['delete']()
            })
          )
          if (destructors !== null) {
            destructors.push(this.rawDestructor, ptr)
          }
        }
        break
      default:
        throwBindingError('Unsupporting sharing policy')
    }
  }
  return ptr
}
function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
  if (handle === null) {
    if (this.isReference) {
      throwBindingError('null is not a valid ' + this.name)
    }
    return 0
  }
  if (!handle.$$) {
    throwBindingError(
      'Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name
    )
  }
  if (!handle.$$.ptr) {
    throwBindingError(
      'Cannot pass deleted object as a pointer of type ' + this.name
    )
  }
  if (handle.$$.ptrType.isConst) {
    throwBindingError(
      'Cannot convert argument of type ' +
        handle.$$.ptrType.name +
        ' to parameter type ' +
        this.name
    )
  }
  var handleClass = handle.$$.ptrType.registeredClass
  var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass)
  return ptr
}
function simpleReadValueFromPointer(pointer) {
  return this['fromWireType'](HEAPU32[pointer >> 2])
}
function RegisteredPointer_getPointee(ptr) {
  if (this.rawGetPointee) {
    ptr = this.rawGetPointee(ptr)
  }
  return ptr
}
function RegisteredPointer_destructor(ptr) {
  if (this.rawDestructor) {
    this.rawDestructor(ptr)
  }
}
function RegisteredPointer_deleteObject(handle) {
  if (handle !== null) {
    handle['delete']()
  }
}
function downcastPointer(ptr, ptrClass, desiredClass) {
  if (ptrClass === desiredClass) {
    return ptr
  }
  if (undefined === desiredClass.baseClass) {
    return null
  }
  var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass)
  if (rv === null) {
    return null
  }
  return desiredClass.downcast(rv)
}
function getInheritedInstanceCount() {
  return Object.keys(registeredInstances).length
}
function getLiveInheritedInstances() {
  var rv = []
  for (var k in registeredInstances) {
    if (registeredInstances.hasOwnProperty(k)) {
      rv.push(registeredInstances[k])
    }
  }
  return rv
}
function setDelayFunction(fn) {
  delayFunction = fn
  if (deletionQueue.length && delayFunction) {
    delayFunction(flushPendingDeletes)
  }
}
function init_embind() {
  Module['getInheritedInstanceCount'] = getInheritedInstanceCount
  Module['getLiveInheritedInstances'] = getLiveInheritedInstances
  Module['flushPendingDeletes'] = flushPendingDeletes
  Module['setDelayFunction'] = setDelayFunction
}
var registeredInstances = {}
function getBasestPointer(class_, ptr) {
  if (ptr === undefined) {
    throwBindingError('ptr should not be undefined')
  }
  while (class_.baseClass) {
    ptr = class_.upcast(ptr)
    class_ = class_.baseClass
  }
  return ptr
}
function getInheritedInstance(class_, ptr) {
  ptr = getBasestPointer(class_, ptr)
  return registeredInstances[ptr]
}
function makeClassHandle(prototype, record) {
  if (!record.ptrType || !record.ptr) {
    throwInternalError('makeClassHandle requires ptr and ptrType')
  }
  var hasSmartPtrType = !!record.smartPtrType
  var hasSmartPtr = !!record.smartPtr
  if (hasSmartPtrType !== hasSmartPtr) {
    throwInternalError('Both smartPtrType and smartPtr must be specified')
  }
  record.count = { value: 1 }
  return attachFinalizer(Object.create(prototype, { $$: { value: record } }))
}
function RegisteredPointer_fromWireType(ptr) {
  var rawPointer = this.getPointee(ptr)
  if (!rawPointer) {
    this.destructor(ptr)
    return null
  }
  var registeredInstance = getInheritedInstance(
    this.registeredClass,
    rawPointer
  )
  if (undefined !== registeredInstance) {
    if (0 === registeredInstance.$$.count.value) {
      registeredInstance.$$.ptr = rawPointer
      registeredInstance.$$.smartPtr = ptr
      return registeredInstance['clone']()
    } else {
      var rv = registeredInstance['clone']()
      this.destructor(ptr)
      return rv
    }
  }
  function makeDefaultHandle() {
    if (this.isSmartPointer) {
      return makeClassHandle(this.registeredClass.instancePrototype, {
        ptrType: this.pointeeType,
        ptr: rawPointer,
        smartPtrType: this,
        smartPtr: ptr,
      })
    } else {
      return makeClassHandle(this.registeredClass.instancePrototype, {
        ptrType: this,
        ptr: ptr,
      })
    }
  }
  var actualType = this.registeredClass.getActualType(rawPointer)
  var registeredPointerRecord = registeredPointers[actualType]
  if (!registeredPointerRecord) {
    return makeDefaultHandle.call(this)
  }
  var toType
  if (this.isConst) {
    toType = registeredPointerRecord.constPointerType
  } else {
    toType = registeredPointerRecord.pointerType
  }
  var dp = downcastPointer(
    rawPointer,
    this.registeredClass,
    toType.registeredClass
  )
  if (dp === null) {
    return makeDefaultHandle.call(this)
  }
  if (this.isSmartPointer) {
    return makeClassHandle(toType.registeredClass.instancePrototype, {
      ptrType: toType,
      ptr: dp,
      smartPtrType: this,
      smartPtr: ptr,
    })
  } else {
    return makeClassHandle(toType.registeredClass.instancePrototype, {
      ptrType: toType,
      ptr: dp,
    })
  }
}
function init_RegisteredPointer() {
  RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee
  RegisteredPointer.prototype.destructor = RegisteredPointer_destructor
  RegisteredPointer.prototype['argPackAdvance'] = 8
  RegisteredPointer.prototype[
    'readValueFromPointer'
  ] = simpleReadValueFromPointer
  RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject
  RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType
}
function RegisteredPointer(
  name,
  registeredClass,
  isReference,
  isConst,
  isSmartPointer,
  pointeeType,
  sharingPolicy,
  rawGetPointee,
  rawConstructor,
  rawShare,
  rawDestructor
) {
  this.name = name
  this.registeredClass = registeredClass
  this.isReference = isReference
  this.isConst = isConst
  this.isSmartPointer = isSmartPointer
  this.pointeeType = pointeeType
  this.sharingPolicy = sharingPolicy
  this.rawGetPointee = rawGetPointee
  this.rawConstructor = rawConstructor
  this.rawShare = rawShare
  this.rawDestructor = rawDestructor
  if (!isSmartPointer && registeredClass.baseClass === undefined) {
    if (isConst) {
      this['toWireType'] = constNoSmartPtrRawPointerToWireType
      this.destructorFunction = null
    } else {
      this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType
      this.destructorFunction = null
    }
  } else {
    this['toWireType'] = genericPointerToWireType
  }
}
function replacePublicSymbol(name, value, numArguments) {
  if (!Module.hasOwnProperty(name)) {
    throwInternalError('Replacing nonexistant public symbol')
  }
  if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
    Module[name].overloadTable[numArguments] = value
  } else {
    Module[name] = value
    Module[name].argCount = numArguments
  }
}
function embind__requireFunction(signature, rawFunction) {
  signature = readLatin1String(signature)
  function makeDynCaller(dynCall) {
    var args = []
    for (var i = 1; i < signature.length; ++i) {
      args.push('a' + i)
    }
    var name = 'dynCall_' + signature + '_' + rawFunction
    var body = 'return function ' + name + '(' + args.join(', ') + ') {\n'
    body +=
      '    return dynCall(rawFunction' +
      (args.length ? ', ' : '') +
      args.join(', ') +
      ');\n'
    body += '};\n'
    return new Function('dynCall', 'rawFunction', body)(dynCall, rawFunction)
  }
  var fp
  if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
    fp = Module['FUNCTION_TABLE_' + signature][rawFunction]
  } else if (typeof FUNCTION_TABLE !== 'undefined') {
    fp = FUNCTION_TABLE[rawFunction]
  } else {
    var dc = Module['dynCall_' + signature]
    if (dc === undefined) {
      dc = Module['dynCall_' + signature.replace(/f/g, 'd')]
      if (dc === undefined) {
        throwBindingError('No dynCall invoker for signature: ' + signature)
      }
    }
    fp = makeDynCaller(dc)
  }
  if (typeof fp !== 'function') {
    throwBindingError(
      'unknown function pointer with signature ' +
        signature +
        ': ' +
        rawFunction
    )
  }
  return fp
}
var UnboundTypeError = undefined
function getTypeName(type) {
  var ptr = ___getTypeName(type)
  var rv = readLatin1String(ptr)
  _free(ptr)
  return rv
}
function throwUnboundTypeError(message, types) {
  var unboundTypes = []
  var seen = {}
  function visit(type) {
    if (seen[type]) {
      return
    }
    if (registeredTypes[type]) {
      return
    }
    if (typeDependencies[type]) {
      typeDependencies[type].forEach(visit)
      return
    }
    unboundTypes.push(type)
    seen[type] = true
  }
  types.forEach(visit)
  throw new UnboundTypeError(
    message + ': ' + unboundTypes.map(getTypeName).join([', '])
  )
}
function __embind_register_class(
  rawType,
  rawPointerType,
  rawConstPointerType,
  baseClassRawType,
  getActualTypeSignature,
  getActualType,
  upcastSignature,
  upcast,
  downcastSignature,
  downcast,
  name,
  destructorSignature,
  rawDestructor
) {
  name = readLatin1String(name)
  getActualType = embind__requireFunction(getActualTypeSignature, getActualType)
  if (upcast) {
    upcast = embind__requireFunction(upcastSignature, upcast)
  }
  if (downcast) {
    downcast = embind__requireFunction(downcastSignature, downcast)
  }
  rawDestructor = embind__requireFunction(destructorSignature, rawDestructor)
  var legalFunctionName = makeLegalFunctionName(name)
  exposePublicSymbol(legalFunctionName, function () {
    throwUnboundTypeError(
      'Cannot construct ' + name + ' due to unbound types',
      [baseClassRawType]
    )
  })
  whenDependentTypesAreResolved(
    [rawType, rawPointerType, rawConstPointerType],
    baseClassRawType ? [baseClassRawType] : [],
    function (base) {
      base = base[0]
      var baseClass
      var basePrototype
      if (baseClassRawType) {
        baseClass = base.registeredClass
        basePrototype = baseClass.instancePrototype
      } else {
        basePrototype = ClassHandle.prototype
      }
      var constructor = createNamedFunction(legalFunctionName, function () {
        if (Object.getPrototypeOf(this) !== instancePrototype) {
          throw new BindingError("Use 'new' to construct " + name)
        }
        if (undefined === registeredClass.constructor_body) {
          throw new BindingError(name + ' has no accessible constructor')
        }
        var body = registeredClass.constructor_body[arguments.length]
        if (undefined === body) {
          throw new BindingError(
            'Tried to invoke ctor of ' +
              name +
              ' with invalid number of parameters (' +
              arguments.length +
              ') - expected (' +
              Object.keys(registeredClass.constructor_body).toString() +
              ') parameters instead!'
          )
        }
        return body.apply(this, arguments)
      })
      var instancePrototype = Object.create(basePrototype, {
        constructor: { value: constructor },
      })
      constructor.prototype = instancePrototype
      var registeredClass = new RegisteredClass(
        name,
        constructor,
        instancePrototype,
        rawDestructor,
        baseClass,
        getActualType,
        upcast,
        downcast
      )
      var referenceConverter = new RegisteredPointer(
        name,
        registeredClass,
        true,
        false,
        false
      )
      var pointerConverter = new RegisteredPointer(
        name + '*',
        registeredClass,
        false,
        false,
        false
      )
      var constPointerConverter = new RegisteredPointer(
        name + ' const*',
        registeredClass,
        false,
        true,
        false
      )
      registeredPointers[rawType] = {
        pointerType: pointerConverter,
        constPointerType: constPointerConverter,
      }
      replacePublicSymbol(legalFunctionName, constructor)
      return [referenceConverter, pointerConverter, constPointerConverter]
    }
  )
}
function heap32VectorToArray(count, firstElement) {
  var array = []
  for (var i = 0; i < count; i++) {
    array.push(HEAP32[(firstElement >> 2) + i])
  }
  return array
}
function runDestructors(destructors) {
  while (destructors.length) {
    var ptr = destructors.pop()
    var del = destructors.pop()
    del(ptr)
  }
}
function __embind_register_class_constructor(
  rawClassType,
  argCount,
  rawArgTypesAddr,
  invokerSignature,
  invoker,
  rawConstructor
) {
  var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr)
  invoker = embind__requireFunction(invokerSignature, invoker)
  whenDependentTypesAreResolved([], [rawClassType], function (classType) {
    classType = classType[0]
    var humanName = 'constructor ' + classType.name
    if (undefined === classType.registeredClass.constructor_body) {
      classType.registeredClass.constructor_body = []
    }
    if (
      undefined !== classType.registeredClass.constructor_body[argCount - 1]
    ) {
      throw new BindingError(
        'Cannot register multiple constructors with identical number of parameters (' +
          (argCount - 1) +
          ") for class '" +
          classType.name +
          "'! Overload resolution is currently only performed using the parameter count, not actual type info!"
      )
    }
    classType.registeredClass.constructor_body[
      argCount - 1
    ] = function unboundTypeHandler() {
      throwUnboundTypeError(
        'Cannot construct ' + classType.name + ' due to unbound types',
        rawArgTypes
      )
    }
    whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
      classType.registeredClass.constructor_body[
        argCount - 1
      ] = function constructor_body() {
        if (arguments.length !== argCount - 1) {
          throwBindingError(
            humanName +
              ' called with ' +
              arguments.length +
              ' arguments, expected ' +
              (argCount - 1)
          )
        }
        var destructors = []
        var args = new Array(argCount)
        args[0] = rawConstructor
        for (var i = 1; i < argCount; ++i) {
          args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1])
        }
        var ptr = invoker.apply(null, args)
        runDestructors(destructors)
        return argTypes[0]['fromWireType'](ptr)
      }
      return []
    })
    return []
  })
}
function new_(constructor, argumentList) {
  if (!(constructor instanceof Function)) {
    throw new TypeError(
      'new_ called with constructor type ' +
        typeof constructor +
        ' which is not a function'
    )
  }
  var dummy = createNamedFunction(
    constructor.name || 'unknownFunctionName',
    function () {}
  )
  dummy.prototype = constructor.prototype
  var obj = new dummy()
  var r = constructor.apply(obj, argumentList)
  return r instanceof Object ? r : obj
}
function craftInvokerFunction(
  humanName,
  argTypes,
  classType,
  cppInvokerFunc,
  cppTargetFunc
) {
  var argCount = argTypes.length
  if (argCount < 2) {
    throwBindingError(
      "argTypes array size mismatch! Must at least get return value and 'this' types!"
    )
  }
  var isClassMethodFunc = argTypes[1] !== null && classType !== null
  var needsDestructorStack = false
  for (var i = 1; i < argTypes.length; ++i) {
    if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
      needsDestructorStack = true
      break
    }
  }
  var returns = argTypes[0].name !== 'void'
  var argsList = ''
  var argsListWired = ''
  for (var i = 0; i < argCount - 2; ++i) {
    argsList += (i !== 0 ? ', ' : '') + 'arg' + i
    argsListWired += (i !== 0 ? ', ' : '') + 'arg' + i + 'Wired'
  }
  var invokerFnBody =
    'return function ' +
    makeLegalFunctionName(humanName) +
    '(' +
    argsList +
    ') {\n' +
    'if (arguments.length !== ' +
    (argCount - 2) +
    ') {\n' +
    "throwBindingError('function " +
    humanName +
    " called with ' + arguments.length + ' arguments, expected " +
    (argCount - 2) +
    " args!');\n" +
    '}\n'
  if (needsDestructorStack) {
    invokerFnBody += 'var destructors = [];\n'
  }
  var dtorStack = needsDestructorStack ? 'destructors' : 'null'
  var args1 = [
    'throwBindingError',
    'invoker',
    'fn',
    'runDestructors',
    'retType',
    'classParam',
  ]
  var args2 = [
    throwBindingError,
    cppInvokerFunc,
    cppTargetFunc,
    runDestructors,
    argTypes[0],
    argTypes[1],
  ]
  if (isClassMethodFunc) {
    invokerFnBody +=
      'var thisWired = classParam.toWireType(' + dtorStack + ', this);\n'
  }
  for (var i = 0; i < argCount - 2; ++i) {
    invokerFnBody +=
      'var arg' +
      i +
      'Wired = argType' +
      i +
      '.toWireType(' +
      dtorStack +
      ', arg' +
      i +
      '); // ' +
      argTypes[i + 2].name +
      '\n'
    args1.push('argType' + i)
    args2.push(argTypes[i + 2])
  }
  if (isClassMethodFunc) {
    argsListWired =
      'thisWired' + (argsListWired.length > 0 ? ', ' : '') + argsListWired
  }
  invokerFnBody +=
    (returns ? 'var rv = ' : '') +
    'invoker(fn' +
    (argsListWired.length > 0 ? ', ' : '') +
    argsListWired +
    ');\n'
  if (needsDestructorStack) {
    invokerFnBody += 'runDestructors(destructors);\n'
  } else {
    for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
      var paramName = i === 1 ? 'thisWired' : 'arg' + (i - 2) + 'Wired'
      if (argTypes[i].destructorFunction !== null) {
        invokerFnBody +=
          paramName + '_dtor(' + paramName + '); // ' + argTypes[i].name + '\n'
        args1.push(paramName + '_dtor')
        args2.push(argTypes[i].destructorFunction)
      }
    }
  }
  if (returns) {
    invokerFnBody += 'var ret = retType.fromWireType(rv);\n' + 'return ret;\n'
  } else {
  }
  invokerFnBody += '}\n'
  args1.push(invokerFnBody)
  var invokerFunction = new_(Function, args1).apply(null, args2)
  return invokerFunction
}
function __embind_register_class_function(
  rawClassType,
  methodName,
  argCount,
  rawArgTypesAddr,
  invokerSignature,
  rawInvoker,
  context,
  isPureVirtual
) {
  var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr)
  methodName = readLatin1String(methodName)
  rawInvoker = embind__requireFunction(invokerSignature, rawInvoker)
  whenDependentTypesAreResolved([], [rawClassType], function (classType) {
    classType = classType[0]
    var humanName = classType.name + '.' + methodName
    if (isPureVirtual) {
      classType.registeredClass.pureVirtualFunctions.push(methodName)
    }
    function unboundTypesHandler() {
      throwUnboundTypeError(
        'Cannot call ' + humanName + ' due to unbound types',
        rawArgTypes
      )
    }
    var proto = classType.registeredClass.instancePrototype
    var method = proto[methodName]
    if (
      undefined === method ||
      (undefined === method.overloadTable &&
        method.className !== classType.name &&
        method.argCount === argCount - 2)
    ) {
      unboundTypesHandler.argCount = argCount - 2
      unboundTypesHandler.className = classType.name
      proto[methodName] = unboundTypesHandler
    } else {
      ensureOverloadTable(proto, methodName, humanName)
      proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler
    }
    whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
      var memberFunction = craftInvokerFunction(
        humanName,
        argTypes,
        classType,
        rawInvoker,
        context
      )
      if (undefined === proto[methodName].overloadTable) {
        memberFunction.argCount = argCount - 2
        proto[methodName] = memberFunction
      } else {
        proto[methodName].overloadTable[argCount - 2] = memberFunction
      }
      return []
    })
    return []
  })
}
var emval_free_list = []
var emval_handle_array = [
  {},
  { value: undefined },
  { value: null },
  { value: true },
  { value: false },
]
function __emval_decref(handle) {
  if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
    emval_handle_array[handle] = undefined
    emval_free_list.push(handle)
  }
}
function count_emval_handles() {
  var count = 0
  for (var i = 5; i < emval_handle_array.length; ++i) {
    if (emval_handle_array[i] !== undefined) {
      ++count
    }
  }
  return count
}
function get_first_emval() {
  for (var i = 5; i < emval_handle_array.length; ++i) {
    if (emval_handle_array[i] !== undefined) {
      return emval_handle_array[i]
    }
  }
  return null
}
function init_emval() {
  Module['count_emval_handles'] = count_emval_handles
  Module['get_first_emval'] = get_first_emval
}
function __emval_register(value) {
  switch (value) {
    case undefined: {
      return 1
    }
    case null: {
      return 2
    }
    case true: {
      return 3
    }
    case false: {
      return 4
    }
    default: {
      var handle = emval_free_list.length
        ? emval_free_list.pop()
        : emval_handle_array.length
      emval_handle_array[handle] = { refcount: 1, value: value }
      return handle
    }
  }
}
function __embind_register_emval(rawType, name) {
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function (handle) {
      var rv = emval_handle_array[handle].value
      __emval_decref(handle)
      return rv
    },
    toWireType: function (destructors, value) {
      return __emval_register(value)
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: null,
  })
}
function _embind_repr(v) {
  if (v === null) {
    return 'null'
  }
  var t = typeof v
  if (t === 'object' || t === 'array' || t === 'function') {
    return v.toString()
  } else {
    return '' + v
  }
}
function floatReadValueFromPointer(name, shift) {
  switch (shift) {
    case 2:
      return function (pointer) {
        return this['fromWireType'](HEAPF32[pointer >> 2])
      }
    case 3:
      return function (pointer) {
        return this['fromWireType'](HEAPF64[pointer >> 3])
      }
    default:
      throw new TypeError('Unknown float type: ' + name)
  }
}
function __embind_register_float(rawType, name, size) {
  var shift = getShiftFromSize(size)
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function (value) {
      return value
    },
    toWireType: function (destructors, value) {
      if (typeof value !== 'number' && typeof value !== 'boolean') {
        throw new TypeError(
          'Cannot convert "' + _embind_repr(value) + '" to ' + this.name
        )
      }
      return value
    },
    argPackAdvance: 8,
    readValueFromPointer: floatReadValueFromPointer(name, shift),
    destructorFunction: null,
  })
}
function integerReadValueFromPointer(name, shift, signed) {
  switch (shift) {
    case 0:
      return signed
        ? function readS8FromPointer(pointer) {
            return HEAP8[pointer]
          }
        : function readU8FromPointer(pointer) {
            return HEAPU8[pointer]
          }
    case 1:
      return signed
        ? function readS16FromPointer(pointer) {
            return HEAP16[pointer >> 1]
          }
        : function readU16FromPointer(pointer) {
            return HEAPU16[pointer >> 1]
          }
    case 2:
      return signed
        ? function readS32FromPointer(pointer) {
            return HEAP32[pointer >> 2]
          }
        : function readU32FromPointer(pointer) {
            return HEAPU32[pointer >> 2]
          }
    default:
      throw new TypeError('Unknown integer type: ' + name)
  }
}
function __embind_register_integer(
  primitiveType,
  name,
  size,
  minRange,
  maxRange
) {
  name = readLatin1String(name)
  if (maxRange === -1) {
    maxRange = 4294967295
  }
  var shift = getShiftFromSize(size)
  var fromWireType = function (value) {
    return value
  }
  if (minRange === 0) {
    var bitshift = 32 - 8 * size
    fromWireType = function (value) {
      return (value << bitshift) >>> bitshift
    }
  }
  var isUnsignedType = name.indexOf('unsigned') != -1
  registerType(primitiveType, {
    name: name,
    fromWireType: fromWireType,
    toWireType: function (destructors, value) {
      if (typeof value !== 'number' && typeof value !== 'boolean') {
        throw new TypeError(
          'Cannot convert "' + _embind_repr(value) + '" to ' + this.name
        )
      }
      if (value < minRange || value > maxRange) {
        throw new TypeError(
          'Passing a number "' +
            _embind_repr(value) +
            '" from JS side to C/C++ side to an argument of type "' +
            name +
            '", which is outside the valid range [' +
            minRange +
            ', ' +
            maxRange +
            ']!'
        )
      }
      return isUnsignedType ? value >>> 0 : value | 0
    },
    argPackAdvance: 8,
    readValueFromPointer: integerReadValueFromPointer(
      name,
      shift,
      minRange !== 0
    ),
    destructorFunction: null,
  })
}
function __embind_register_memory_view(rawType, dataTypeIndex, name) {
  var typeMapping = [
    Int8Array,
    Uint8Array,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
  ]
  var TA = typeMapping[dataTypeIndex]
  function decodeMemoryView(handle) {
    handle = handle >> 2
    var heap = HEAPU32
    var size = heap[handle]
    var data = heap[handle + 1]
    return new TA(heap['buffer'], data, size)
  }
  name = readLatin1String(name)
  registerType(
    rawType,
    {
      name: name,
      fromWireType: decodeMemoryView,
      argPackAdvance: 8,
      readValueFromPointer: decodeMemoryView,
    },
    { ignoreDuplicateRegistrations: true }
  )
}
function __embind_register_std_string(rawType, name) {
  name = readLatin1String(name)
  var stdStringIsUTF8 = name === 'std::string'
  registerType(rawType, {
    name: name,
    fromWireType: function (value) {
      var length = HEAPU32[value >> 2]
      var str
      if (stdStringIsUTF8) {
        var endChar = HEAPU8[value + 4 + length]
        var endCharSwap = 0
        if (endChar != 0) {
          endCharSwap = endChar
          HEAPU8[value + 4 + length] = 0
        }
        var decodeStartPtr = value + 4
        for (var i = 0; i <= length; ++i) {
          var currentBytePtr = value + 4 + i
          if (HEAPU8[currentBytePtr] == 0) {
            var stringSegment = UTF8ToString(decodeStartPtr)
            if (str === undefined) str = stringSegment
            else {
              str += String.fromCharCode(0)
              str += stringSegment
            }
            decodeStartPtr = currentBytePtr + 1
          }
        }
        if (endCharSwap != 0) HEAPU8[value + 4 + length] = endCharSwap
      } else {
        var a = new Array(length)
        for (var i = 0; i < length; ++i) {
          a[i] = String.fromCharCode(HEAPU8[value + 4 + i])
        }
        str = a.join('')
      }
      _free(value)
      return str
    },
    toWireType: function (destructors, value) {
      if (value instanceof ArrayBuffer) {
        value = new Uint8Array(value)
      }
      var getLength
      var valueIsOfTypeString = typeof value === 'string'
      if (
        !(
          valueIsOfTypeString ||
          value instanceof Uint8Array ||
          value instanceof Uint8ClampedArray ||
          value instanceof Int8Array
        )
      ) {
        throwBindingError('Cannot pass non-string to std::string')
      }
      if (stdStringIsUTF8 && valueIsOfTypeString) {
        getLength = function () {
          return lengthBytesUTF8(value)
        }
      } else {
        getLength = function () {
          return value.length
        }
      }
      var length = getLength()
      var ptr = _malloc(4 + length + 1)
      HEAPU32[ptr >> 2] = length
      if (stdStringIsUTF8 && valueIsOfTypeString) {
        stringToUTF8(value, ptr + 4, length + 1)
      } else {
        if (valueIsOfTypeString) {
          for (var i = 0; i < length; ++i) {
            var charCode = value.charCodeAt(i)
            if (charCode > 255) {
              _free(ptr)
              throwBindingError(
                'String has UTF-16 code units that do not fit in 8 bits'
              )
            }
            HEAPU8[ptr + 4 + i] = charCode
          }
        } else {
          for (var i = 0; i < length; ++i) {
            HEAPU8[ptr + 4 + i] = value[i]
          }
        }
      }
      if (destructors !== null) {
        destructors.push(_free, ptr)
      }
      return ptr
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: function (ptr) {
      _free(ptr)
    },
  })
}
function __embind_register_std_wstring(rawType, charSize, name) {
  name = readLatin1String(name)
  var getHeap, shift
  if (charSize === 2) {
    getHeap = function () {
      return HEAPU16
    }
    shift = 1
  } else if (charSize === 4) {
    getHeap = function () {
      return HEAPU32
    }
    shift = 2
  }
  registerType(rawType, {
    name: name,
    fromWireType: function (value) {
      var HEAP = getHeap()
      var length = HEAPU32[value >> 2]
      var a = new Array(length)
      var start = (value + 4) >> shift
      for (var i = 0; i < length; ++i) {
        a[i] = String.fromCharCode(HEAP[start + i])
      }
      _free(value)
      return a.join('')
    },
    toWireType: function (destructors, value) {
      var HEAP = getHeap()
      var length = value.length
      var ptr = _malloc(4 + length * charSize)
      HEAPU32[ptr >> 2] = length
      var start = (ptr + 4) >> shift
      for (var i = 0; i < length; ++i) {
        HEAP[start + i] = value.charCodeAt(i)
      }
      if (destructors !== null) {
        destructors.push(_free, ptr)
      }
      return ptr
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: function (ptr) {
      _free(ptr)
    },
  })
}
function __embind_register_void(rawType, name) {
  name = readLatin1String(name)
  registerType(rawType, {
    isVoid: true,
    name: name,
    argPackAdvance: 0,
    fromWireType: function () {
      return undefined
    },
    toWireType: function (destructors, o) {
      return undefined
    },
  })
}
function _abort() {
  Module['abort']()
}
function _emscripten_get_heap_size() {
  return HEAP8.length
}
function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
}
function ___setErrNo(value) {
  if (Module['___errno_location'])
    HEAP32[Module['___errno_location']() >> 2] = value
  return value
}
function abortOnCannotGrowMemory(requestedSize) {
  abort('OOM')
}
function _emscripten_resize_heap(requestedSize) {
  abortOnCannotGrowMemory(requestedSize)
}
embind_init_charCodes()
BindingError = Module['BindingError'] = extendError(Error, 'BindingError')
InternalError = Module['InternalError'] = extendError(Error, 'InternalError')
init_ClassHandle()
init_RegisteredPointer()
init_embind()
UnboundTypeError = Module['UnboundTypeError'] = extendError(
  Error,
  'UnboundTypeError'
)
init_emval()
var ASSERTIONS = false
var asmGlobalArg = {
  Math: Math,
  Int8Array: Int8Array,
  Int16Array: Int16Array,
  Int32Array: Int32Array,
  Uint8Array: Uint8Array,
  Uint16Array: Uint16Array,
  Float32Array: Float32Array,
  Float64Array: Float64Array,
}
var asmLibraryArg = {
  a: abort,
  b: setTempRet0,
  c: getTempRet0,
  d: ClassHandle,
  e: ClassHandle_clone,
  f: ClassHandle_delete,
  g: ClassHandle_deleteLater,
  h: ClassHandle_isAliasOf,
  i: ClassHandle_isDeleted,
  j: RegisteredClass,
  k: RegisteredPointer,
  l: RegisteredPointer_deleteObject,
  m: RegisteredPointer_destructor,
  n: RegisteredPointer_fromWireType,
  o: RegisteredPointer_getPointee,
  p: ___cxa_allocate_exception,
  q: ___cxa_begin_catch,
  r: ___cxa_throw,
  s: ___cxa_uncaught_exception,
  t: ___exception_addRef,
  u: ___exception_deAdjust,
  v: ___gxx_personality_v0,
  w: ___setErrNo,
  x: ___syscall140,
  y: ___syscall146,
  z: ___syscall6,
  A: __embind_register_bool,
  B: __embind_register_class,
  C: __embind_register_class_constructor,
  D: __embind_register_class_function,
  E: __embind_register_emval,
  F: __embind_register_float,
  G: __embind_register_integer,
  H: __embind_register_memory_view,
  I: __embind_register_std_string,
  J: __embind_register_std_wstring,
  K: __embind_register_void,
  L: __emval_decref,
  M: __emval_register,
  N: _abort,
  O: _embind_repr,
  P: _emscripten_get_heap_size,
  Q: _emscripten_memcpy_big,
  R: _emscripten_resize_heap,
  S: abortOnCannotGrowMemory,
  T: attachFinalizer,
  U: constNoSmartPtrRawPointerToWireType,
  V: count_emval_handles,
  W: craftInvokerFunction,
  X: createNamedFunction,
  Y: detachFinalizer,
  Z: downcastPointer,
  _: embind__requireFunction,
  $: embind_init_charCodes,
  aa: ensureOverloadTable,
  ab: exposePublicSymbol,
  ac: extendError,
  ad: floatReadValueFromPointer,
  ae: flushPendingDeletes,
  af: flush_NO_FILESYSTEM,
  ag: genericPointerToWireType,
  ah: getBasestPointer,
  ai: getInheritedInstance,
  aj: getInheritedInstanceCount,
  ak: getLiveInheritedInstances,
  al: getShiftFromSize,
  am: getTypeName,
  an: get_first_emval,
  ao: heap32VectorToArray,
  ap: init_ClassHandle,
  aq: init_RegisteredPointer,
  ar: init_embind,
  as: init_emval,
  at: integerReadValueFromPointer,
  au: makeClassHandle,
  av: makeLegalFunctionName,
  aw: new_,
  ax: nonConstNoSmartPtrRawPointerToWireType,
  ay: readLatin1String,
  az: registerType,
  aA: releaseClassHandle,
  aB: replacePublicSymbol,
  aC: runDestructor,
  aD: runDestructors,
  aE: setDelayFunction,
  aF: shallowCopyInternalPointer,
  aG: simpleReadValueFromPointer,
  aH: throwBindingError,
  aI: throwInstanceAlreadyDeleted,
  aJ: throwInternalError,
  aK: throwUnboundTypeError,
  aL: upcastPointer,
  aM: whenDependentTypesAreResolved,
  aN: tempDoublePtr,
  aO: DYNAMICTOP_PTR,
} // EMSCRIPTEN_START_ASM
var asm = /** @suppress {uselessCode} */ (function (global, env, buffer) {
  'use asm'
  var a = new global.Int8Array(buffer),
    b = new global.Int16Array(buffer),
    c = new global.Int32Array(buffer),
    d = new global.Uint8Array(buffer),
    e = new global.Uint16Array(buffer),
    f = new global.Float32Array(buffer),
    g = new global.Float64Array(buffer),
    h = env.aN | 0,
    i = env.aO | 0,
    j = 0,
    k = 0,
    l = 0,
    m = 0,
    n = 0,
    o = 0,
    p = 0,
    q = 0.0,
    r = global.Math.imul,
    s = global.Math.clz32,
    t = env.a,
    u = env.b,
    v = env.c,
    w = env.d,
    x = env.e,
    y = env.f,
    z = env.g,
    A = env.h,
    B = env.i,
    C = env.j,
    D = env.k,
    E = env.l,
    F = env.m,
    G = env.n,
    H = env.o,
    I = env.p,
    J = env.q,
    K = env.r,
    L = env.s,
    M = env.t,
    N = env.u,
    O = env.v,
    P = env.w,
    Q = env.x,
    R = env.y,
    S = env.z,
    T = env.A,
    U = env.B,
    V = env.C,
    W = env.D,
    X = env.E,
    Y = env.F,
    Z = env.G,
    _ = env.H,
    $ = env.I,
    aa = env.J,
    ba = env.K,
    ca = env.L,
    da = env.M,
    ea = env.N,
    fa = env.O,
    ga = env.P,
    ha = env.Q,
    ia = env.R,
    ja = env.S,
    ka = env.T,
    la = env.U,
    ma = env.V,
    na = env.W,
    oa = env.X,
    pa = env.Y,
    qa = env.Z,
    ra = env._,
    sa = env.$,
    ta = env.aa,
    ua = env.ab,
    va = env.ac,
    wa = env.ad,
    xa = env.ae,
    ya = env.af,
    za = env.ag,
    Aa = env.ah,
    Ba = env.ai,
    Ca = env.aj,
    Da = env.ak,
    Ea = env.al,
    Fa = env.am,
    Ga = env.an,
    Ha = env.ao,
    Ia = env.ap,
    Ja = env.aq,
    Ka = env.ar,
    La = env.as,
    Ma = env.at,
    Na = env.au,
    Oa = env.av,
    Pa = env.aw,
    Qa = env.ax,
    Ra = env.ay,
    Sa = env.az,
    Ta = env.aA,
    Ua = env.aB,
    Va = env.aC,
    Wa = env.aD,
    Xa = env.aE,
    Ya = env.aF,
    Za = env.aG,
    _a = env.aH,
    $a = env.aI,
    ab = env.aJ,
    bb = env.aK,
    cb = env.aL,
    db = env.aM,
    eb = 19616,
    fb = 5262496,
    gb = 0.0
  // EMSCRIPTEN_START_FUNCS
  function ub() {
    ug()
    vg()
  }
  function vb(a) {
    a = a | 0
    var b = 0
    b = eb
    eb = (eb + a) | 0
    eb = (eb + 15) & -16
    return b | 0
  }
  function wb() {
    return eb | 0
  }
  function xb(a) {
    a = a | 0
    eb = a
  }
  function yb(a, b) {
    a = a | 0
    b = b | 0
    eb = a
    fb = b
  }
  function zb(a) {
    a = a | 0
    U(1456, 1464, 1480, 0, 16312, 7, 16315, 0, 16315, 0, 3952, 16317, 126)
    V(1456, 1, 3392, 16312, 8, 1)
    a = wh(8) | 0
    c[a >> 2] = 1
    c[(a + 4) >> 2] = 0
    W(1456, 3959, 4, 144, 16320, 4, a | 0, 0)
    a = wh(8) | 0
    c[a >> 2] = 3
    c[(a + 4) >> 2] = 0
    W(1456, 3964, 3, 3396, 16326, 2, a | 0, 0)
    a = wh(8) | 0
    c[a >> 2] = 9
    c[(a + 4) >> 2] = 0
    W(1456, 3973, 2, 3408, 16331, 40, a | 0, 0)
    U(1496, 1504, 1520, 0, 16312, 10, 16315, 0, 16315, 0, 3982, 16317, 127)
    V(1496, 1, 3416, 16312, 11, 2)
    a = wh(8) | 0
    c[a >> 2] = 3
    c[(a + 4) >> 2] = 0
    W(1496, 3959, 4, 160, 16320, 5, a | 0, 0)
    a = wh(8) | 0
    c[a >> 2] = 4
    c[(a + 4) >> 2] = 0
    W(1496, 3996, 3, 3420, 16326, 4, a | 0, 0)
    a = wh(8) | 0
    c[a >> 2] = 5
    c[(a + 4) >> 2] = 0
    W(1496, 4013, 3, 3420, 16326, 4, a | 0, 0)
    a = wh(8) | 0
    c[a >> 2] = 6
    c[(a + 4) >> 2] = 0
    W(1496, 4028, 3, 3420, 16326, 4, a | 0, 0)
    a = wh(8) | 0
    c[a >> 2] = 7
    c[(a + 4) >> 2] = 0
    W(1496, 3964, 3, 3432, 16326, 5, a | 0, 0)
    return
  }
  function Ab(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    f = eb
    eb = (eb + 32) | 0
    g = (f + 8) | 0
    h = f
    i = (f + 16) | 0
    j = wh(20) | 0
    c[j >> 2] = d
    c[(j + 4) >> 2] = e
    c[(j + 8) >> 2] = 0
    a[(j + 12) >> 0] = 0
    a[(j + 13) >> 0] = 0
    c[(j + 16) >> 2] = 0
    c[i >> 2] = j
    e = wh(16) | 0
    c[(e + 4) >> 2] = 0
    c[(e + 8) >> 2] = 0
    c[e >> 2] = 2208
    c[(e + 12) >> 2] = j
    d = (i + 4) | 0
    c[d >> 2] = e
    c[h >> 2] = j
    c[(h + 4) >> 2] = j
    Jb(i, h)
    j = c[i >> 2] | 0
    c[i >> 2] = c[b >> 2]
    c[b >> 2] = j
    j = (b + 4) | 0
    i = c[d >> 2] | 0
    e = c[j >> 2] | 0
    c[d >> 2] = e
    c[j >> 2] = i
    i = e
    if (
      e | 0
        ? ((j = (i + 4) | 0),
          (d = c[j >> 2] | 0),
          (c[j >> 2] = d + -1),
          (d | 0) == 0)
        : 0
    ) {
      ob[c[((c[e >> 2] | 0) + 8) >> 2] & 255](i)
      th(i)
    }
    i = wh(352) | 0
    Ib(i, c[b >> 2] | 0)
    c[h >> 2] = i
    e = wh(16) | 0
    d = (b + 8) | 0
    c[(e + 4) >> 2] = 0
    c[(e + 8) >> 2] = 0
    c[e >> 2] = 2236
    c[(e + 12) >> 2] = i
    j = (h + 4) | 0
    c[j >> 2] = e
    c[g >> 2] = i
    c[(g + 4) >> 2] = i
    Pb(h, g)
    g = c[h >> 2] | 0
    c[h >> 2] = c[d >> 2]
    c[d >> 2] = g
    g = (b + 12) | 0
    b = c[j >> 2] | 0
    d = c[g >> 2] | 0
    c[j >> 2] = d
    c[g >> 2] = b
    b = d
    if (!d) {
      eb = f
      return
    }
    g = (b + 4) | 0
    j = c[g >> 2] | 0
    c[g >> 2] = j + -1
    if (j | 0) {
      eb = f
      return
    }
    ob[c[((c[d >> 2] | 0) + 8) >> 2] & 255](b)
    th(b)
    eb = f
    return
  }
  function Bb(a, b) {
    a = a | 0
    b = b | 0
    Oc(c[(a + 8) >> 2] | 0, b)
    return
  }
  function Cb(a) {
    a = a | 0
    var b = 0
    b = ((c[(a + 8) >> 2] | 0) + 127) | 0
    return (
      d[b >> 0] |
      (d[(b + 1) >> 0] << 8) |
      (d[(b + 2) >> 0] << 16) |
      (d[(b + 3) >> 0] << 24) |
      0
    )
  }
  function Db(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0
    f = eb
    eb = (eb + 32) | 0
    g = (f + 16) | 0
    h = (f + 8) | 0
    i = f
    j = (f + 24) | 0
    k = wh(12) | 0
    c[k >> 2] = d
    c[(k + 4) >> 2] = e
    c[(k + 8) >> 2] = 0
    c[j >> 2] = k
    e = wh(16) | 0
    c[(e + 4) >> 2] = 0
    c[(e + 8) >> 2] = 0
    c[e >> 2] = 2984
    c[(e + 12) >> 2] = k
    d = (j + 4) | 0
    c[d >> 2] = e
    c[i >> 2] = k
    c[(i + 4) >> 2] = k
    Ne(j, i)
    k = c[j >> 2] | 0
    c[j >> 2] = c[b >> 2]
    c[b >> 2] = k
    k = (b + 4) | 0
    j = c[d >> 2] | 0
    e = c[k >> 2] | 0
    c[d >> 2] = e
    c[k >> 2] = j
    j = e
    if (
      e | 0
        ? ((k = (j + 4) | 0),
          (d = c[k >> 2] | 0),
          (c[k >> 2] = d + -1),
          (d | 0) == 0)
        : 0
    ) {
      ob[c[((c[e >> 2] | 0) + 8) >> 2] & 255](j)
      th(j)
    }
    j = wh(12) | 0
    c[j >> 2] = c[b >> 2]
    c[(j + 4) >> 2] = 0
    c[(j + 8) >> 2] = -1
    c[i >> 2] = j
    e = wh(16) | 0
    d = (b + 8) | 0
    c[(e + 4) >> 2] = 0
    c[(e + 8) >> 2] = 0
    c[e >> 2] = 3012
    c[(e + 12) >> 2] = j
    k = (i + 4) | 0
    c[k >> 2] = e
    c[h >> 2] = j
    c[(h + 4) >> 2] = j
    Se(i, h)
    j = c[i >> 2] | 0
    c[i >> 2] = c[d >> 2]
    c[d >> 2] = j
    j = (b + 12) | 0
    i = c[k >> 2] | 0
    e = c[j >> 2] | 0
    c[k >> 2] = e
    c[j >> 2] = i
    i = e
    if (
      e | 0
        ? ((j = (i + 4) | 0),
          (k = c[j >> 2] | 0),
          (c[j >> 2] = k + -1),
          (k | 0) == 0)
        : 0
    ) {
      ob[c[((c[e >> 2] | 0) + 8) >> 2] & 255](i)
      th(i)
    }
    i = c[d >> 2] | 0
    d = wh(24) | 0
    c[d >> 2] = 3040
    c[(d + 4) >> 2] = i
    c[(d + 8) >> 2] = 0
    c[(d + 12) >> 2] = 0
    c[(d + 16) >> 2] = 0
    a[(d + 20) >> 0] = 1
    c[h >> 2] = d
    i = wh(16) | 0
    c[(i + 4) >> 2] = 0
    c[(i + 8) >> 2] = 0
    c[i >> 2] = 3060
    c[(i + 12) >> 2] = d
    e = (h + 4) | 0
    c[e >> 2] = i
    c[g >> 2] = d
    c[(g + 4) >> 2] = d
    _e(h, g)
    g = c[h >> 2] | 0
    d = c[e >> 2] | 0
    c[h >> 2] = 0
    c[e >> 2] = 0
    c[(b + 16) >> 2] = g
    g = (b + 20) | 0
    b = c[g >> 2] | 0
    c[g >> 2] = d
    if (
      b | 0
        ? ((d = (b + 4) | 0),
          (g = c[d >> 2] | 0),
          (c[d >> 2] = g + -1),
          (g | 0) == 0)
        : 0
    ) {
      ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
      th(b)
    }
    b = c[e >> 2] | 0
    if (!b) {
      eb = f
      return
    }
    e = (b + 4) | 0
    g = c[e >> 2] | 0
    c[e >> 2] = g + -1
    if (g | 0) {
      eb = f
      return
    }
    ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
    th(b)
    eb = f
    return
  }
  function Eb(a, b) {
    a = a | 0
    b = b | 0
    var d = 0
    d = (a + 16) | 0
    a = c[d >> 2] | 0
    if (!a) return
    switch (b | 0) {
      case 4: {
        df(a)
        return
      }
      case 8: {
        ef(a)
        ef(c[d >> 2] | 0)
        return
      }
      default:
        return
    }
  }
  function Fb(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0
    d = (a + 16) | 0
    a = c[d >> 2] | 0
    if (!a) return
    switch (b | 0) {
      case 1: {
        Af(a)
        return
      }
      case 2: {
        Bf(a)
        return
      }
      case 8: {
        df(a)
        e = c[d >> 2] | 0
        break
      }
      case 4: {
        e = a
        break
      }
      default:
        return
    }
    df(e)
    return
  }
  function Gb(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0
    d = (a + 16) | 0
    a = c[d >> 2] | 0
    if (!a) return
    switch (b | 0) {
      case 1: {
        Qf(a)
        return
      }
      case 2: {
        Rf(a)
        return
      }
      case 8: {
        ef(a)
        e = c[d >> 2] | 0
        break
      }
      case 4: {
        e = a
        break
      }
      default:
        return
    }
    ef(e)
    return
  }
  function Hb(a, b) {
    a = a | 0
    b = b | 0
    var d = 0
    d = c[(a + 16) >> 2] | 0
    if (!d) return
    kb[c[c[d >> 2] >> 2] & 63](d, b) | 0
    return
  }
  function Ib(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0
    c[b >> 2] = d
    c[(b + 4) >> 2] = d
    c[(b + 8) >> 2] = 0
    c[(b + 12) >> 2] = 0
    d = fh(1048644) | 0
    e = (d + 68) & -64
    c[(e + -4) >> 2] = d
    c[(b + 16) >> 2] = e
    e = (b + 279) | 0
    a[e >> 0] = 0
    a[(e + 1) >> 0] = 0
    e = (b + 281) | 0
    a[e >> 0] = 0
    a[(e + 1) >> 0] = 0
    a[(e + 2) >> 0] = 0
    a[(e + 3) >> 0] = 0
    e = (b + 344) | 0
    d = (b + 288) | 0
    f = (d + 56) | 0
    do {
      c[d >> 2] = 0
      d = (d + 4) | 0
    } while ((d | 0) < (f | 0))
    d = e
    c[d >> 2] = -1
    c[(d + 4) >> 2] = -1
    Vb(b)
    return
  }
  function Jb(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function Kb(a) {
    a = a | 0
    J(a | 0) | 0
    fi()
  }
  function Lb(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Mb(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    yh(b)
    return
  }
  function Nb(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 4155 ? (a + 12) | 0 : 0) | 0
  }
  function Ob(a) {
    a = a | 0
    yh(a)
    return
  }
  function Pb(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function Qb(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Rb(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    Ub(b)
    yh(b)
    return
  }
  function Sb(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 4353 ? (a + 12) | 0 : 0) | 0
  }
  function Tb(a) {
    a = a | 0
    yh(a)
    return
  }
  function Ub(a) {
    a = a | 0
    var b = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    b = c[(a + 324) >> 2] | 0
    if (
      b | 0
        ? ((e = (b + 4) | 0),
          (f = c[e >> 2] | 0),
          (c[e >> 2] = f + -1),
          (f | 0) == 0)
        : 0
    ) {
      ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
      th(b)
    }
    b = c[(a + 316) >> 2] | 0
    if (
      b | 0
        ? ((f = (b + 4) | 0),
          (e = c[f >> 2] | 0),
          (c[f >> 2] = e + -1),
          (e | 0) == 0)
        : 0
    ) {
      ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
      th(b)
    }
    b = c[(a + 300) >> 2] | 0
    if (b | 0) {
      c[(a + 304) >> 2] = b
      yh(b)
    }
    b = c[(a + 288) >> 2] | 0
    if (b | 0) {
      c[(a + 292) >> 2] = b
      yh(b)
    }
    b = (a + 281) | 0
    e =
      d[b >> 0] |
      (d[(b + 1) >> 0] << 8) |
      (d[(b + 2) >> 0] << 16) |
      (d[(b + 3) >> 0] << 24)
    if (!e) {
      g = (a + 16) | 0
      h = c[g >> 2] | 0
      i = (h + -4) | 0
      j = c[i >> 2] | 0
      gh(j)
      return
    }
    zh(e)
    g = (a + 16) | 0
    h = c[g >> 2] | 0
    i = (h + -4) | 0
    j = c[i >> 2] | 0
    gh(j)
    return
  }
  function Vb(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0.0,
      t = 0.0,
      u = 0.0,
      v = 0.0,
      w = 0.0,
      x = 0.0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0
    d = eb
    eb = (eb + 32) | 0
    e = (d + 24) | 0
    f = d
    i = c[b >> 2] | 0
    j = (i + 13) | 0
    if (!(a[j >> 0] | 0)) {
      k = c[(i + 4) >> 2] | 0
      l = (i + 8) | 0
      m = c[l >> 2] | 0
      n = (k - m) | 0
      o = (n | 0) < 4 ? n : 4
      if (o | 0) Ti(e | 0, ((c[i >> 2] | 0) + m) | 0, o | 0) | 0
      n = (m + o) | 0
      c[l >> 2] = n
      c[(i + 16) >> 2] = o
      if ((n | 0) >= (k | 0)) a[j >> 0] = 1
    } else a[(i + 12) >> 0] = 1
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    i = (f + 11) | 0
    a[i >> 0] = 4
    a[f >> 0] = a[e >> 0] | 0
    a[(f + 1) >> 0] = a[(e + 1) >> 0] | 0
    a[(f + 2) >> 0] = a[(e + 2) >> 0] | 0
    a[(f + 3) >> 0] = a[(e + 3) >> 0] | 0
    a[(f + 4) >> 0] = 0
    e = (Hh(f, 0, -1, 4441, 4) | 0) == 0
    if ((a[i >> 0] | 0) < 0) yh(c[f >> 2] | 0)
    if (!e) {
      e = I(8) | 0
      Wb(e)
      K(e | 0, 688, 8)
    }
    e = c[b >> 2] | 0
    i = (e + 4) | 0
    j = c[i >> 2] | 0
    if ((j | 0) > 0) c[(e + 8) >> 2] = 0
    else a[(e + 12) >> 0] = 1
    k = (b + 20) | 0
    n = (e + 13) | 0
    if (!(a[n >> 0] | 0)) {
      o = (e + 8) | 0
      l = c[o >> 2] | 0
      m = (j - l) | 0
      p = (m | 0) < 227 ? m : 227
      if (!p) {
        q = l
        r = j
      } else {
        Ui(k | 0, ((c[e >> 2] | 0) + l) | 0, p | 0) | 0
        q = c[o >> 2] | 0
        r = c[i >> 2] | 0
      }
      i = (q + p) | 0
      c[o >> 2] = i
      c[(e + 16) >> 2] = p
      if ((i | 0) >= (r | 0)) a[n >> 0] = 1
    } else a[(e + 12) >> 0] = 1
    e = (b + 199) | 0
    a[h >> 0] = a[e >> 0]
    a[(h + 1) >> 0] = a[(e + 1) >> 0]
    a[(h + 2) >> 0] = a[(e + 2) >> 0]
    a[(h + 3) >> 0] = a[(e + 3) >> 0]
    a[(h + 4) >> 0] = a[(e + 4) >> 0]
    a[(h + 5) >> 0] = a[(e + 5) >> 0]
    a[(h + 6) >> 0] = a[(e + 6) >> 0]
    a[(h + 7) >> 0] = a[(e + 7) >> 0]
    s = +g[h >> 3]
    n = (b + 207) | 0
    a[h >> 0] = a[n >> 0]
    a[(h + 1) >> 0] = a[(n + 1) >> 0]
    a[(h + 2) >> 0] = a[(n + 2) >> 0]
    a[(h + 3) >> 0] = a[(n + 3) >> 0]
    a[(h + 4) >> 0] = a[(n + 4) >> 0]
    a[(h + 5) >> 0] = a[(n + 5) >> 0]
    a[(h + 6) >> 0] = a[(n + 6) >> 0]
    a[(h + 7) >> 0] = a[(n + 7) >> 0]
    t = +g[h >> 3]
    r = (b + 215) | 0
    a[h >> 0] = a[r >> 0]
    a[(h + 1) >> 0] = a[(r + 1) >> 0]
    a[(h + 2) >> 0] = a[(r + 2) >> 0]
    a[(h + 3) >> 0] = a[(r + 3) >> 0]
    a[(h + 4) >> 0] = a[(r + 4) >> 0]
    a[(h + 5) >> 0] = a[(r + 5) >> 0]
    a[(h + 6) >> 0] = a[(r + 6) >> 0]
    a[(h + 7) >> 0] = a[(r + 7) >> 0]
    u = +g[h >> 3]
    i = (b + 223) | 0
    a[h >> 0] = a[i >> 0]
    a[(h + 1) >> 0] = a[(i + 1) >> 0]
    a[(h + 2) >> 0] = a[(i + 2) >> 0]
    a[(h + 3) >> 0] = a[(i + 3) >> 0]
    a[(h + 4) >> 0] = a[(i + 4) >> 0]
    a[(h + 5) >> 0] = a[(i + 5) >> 0]
    a[(h + 6) >> 0] = a[(i + 6) >> 0]
    a[(h + 7) >> 0] = a[(i + 7) >> 0]
    v = +g[h >> 3]
    p = (b + 231) | 0
    a[h >> 0] = a[p >> 0]
    a[(h + 1) >> 0] = a[(p + 1) >> 0]
    a[(h + 2) >> 0] = a[(p + 2) >> 0]
    a[(h + 3) >> 0] = a[(p + 3) >> 0]
    a[(h + 4) >> 0] = a[(p + 4) >> 0]
    a[(h + 5) >> 0] = a[(p + 5) >> 0]
    a[(h + 6) >> 0] = a[(p + 6) >> 0]
    a[(h + 7) >> 0] = a[(p + 7) >> 0]
    w = +g[h >> 3]
    o = (b + 239) | 0
    a[h >> 0] = a[o >> 0]
    a[(h + 1) >> 0] = a[(o + 1) >> 0]
    a[(h + 2) >> 0] = a[(o + 2) >> 0]
    a[(h + 3) >> 0] = a[(o + 3) >> 0]
    a[(h + 4) >> 0] = a[(o + 4) >> 0]
    a[(h + 5) >> 0] = a[(o + 5) >> 0]
    a[(h + 6) >> 0] = a[(o + 6) >> 0]
    a[(h + 7) >> 0] = a[(o + 7) >> 0]
    x = +g[h >> 3]
    g[h >> 3] = t
    a[e >> 0] = a[h >> 0]
    a[(e + 1) >> 0] = a[(h + 1) >> 0]
    a[(e + 2) >> 0] = a[(h + 2) >> 0]
    a[(e + 3) >> 0] = a[(h + 3) >> 0]
    a[(e + 4) >> 0] = a[(h + 4) >> 0]
    a[(e + 5) >> 0] = a[(h + 5) >> 0]
    a[(e + 6) >> 0] = a[(h + 6) >> 0]
    a[(e + 7) >> 0] = a[(h + 7) >> 0]
    g[h >> 3] = s
    a[i >> 0] = a[h >> 0]
    a[(i + 1) >> 0] = a[(h + 1) >> 0]
    a[(i + 2) >> 0] = a[(h + 2) >> 0]
    a[(i + 3) >> 0] = a[(h + 3) >> 0]
    a[(i + 4) >> 0] = a[(h + 4) >> 0]
    a[(i + 5) >> 0] = a[(h + 5) >> 0]
    a[(i + 6) >> 0] = a[(h + 6) >> 0]
    a[(i + 7) >> 0] = a[(h + 7) >> 0]
    g[h >> 3] = v
    a[n >> 0] = a[h >> 0]
    a[(n + 1) >> 0] = a[(h + 1) >> 0]
    a[(n + 2) >> 0] = a[(h + 2) >> 0]
    a[(n + 3) >> 0] = a[(h + 3) >> 0]
    a[(n + 4) >> 0] = a[(h + 4) >> 0]
    a[(n + 5) >> 0] = a[(h + 5) >> 0]
    a[(n + 6) >> 0] = a[(h + 6) >> 0]
    a[(n + 7) >> 0] = a[(h + 7) >> 0]
    g[h >> 3] = u
    a[p >> 0] = a[h >> 0]
    a[(p + 1) >> 0] = a[(h + 1) >> 0]
    a[(p + 2) >> 0] = a[(h + 2) >> 0]
    a[(p + 3) >> 0] = a[(h + 3) >> 0]
    a[(p + 4) >> 0] = a[(h + 4) >> 0]
    a[(p + 5) >> 0] = a[(h + 5) >> 0]
    a[(p + 6) >> 0] = a[(h + 6) >> 0]
    a[(p + 7) >> 0] = a[(h + 7) >> 0]
    g[h >> 3] = x
    a[r >> 0] = a[h >> 0]
    a[(r + 1) >> 0] = a[(h + 1) >> 0]
    a[(r + 2) >> 0] = a[(h + 2) >> 0]
    a[(r + 3) >> 0] = a[(h + 3) >> 0]
    a[(r + 4) >> 0] = a[(h + 4) >> 0]
    a[(r + 5) >> 0] = a[(h + 5) >> 0]
    a[(r + 6) >> 0] = a[(h + 6) >> 0]
    a[(r + 7) >> 0] = a[(h + 7) >> 0]
    g[h >> 3] = w
    a[o >> 0] = a[h >> 0]
    a[(o + 1) >> 0] = a[(h + 1) >> 0]
    a[(o + 2) >> 0] = a[(h + 2) >> 0]
    a[(o + 3) >> 0] = a[(h + 3) >> 0]
    a[(o + 4) >> 0] = a[(h + 4) >> 0]
    a[(o + 5) >> 0] = a[(h + 5) >> 0]
    a[(o + 6) >> 0] = a[(h + 6) >> 0]
    a[(o + 7) >> 0] = a[(h + 7) >> 0]
    o = Xb() | 0
    r = c[o >> 2] | 0
    p = c[(o + 4) >> 2] | 0
    a: do
      if ((r | 0) != (p | 0)) {
        o = (f + 16) | 0
        n = r
        while (1) {
          i = (n + 16) | 0
          e = c[i >> 2] | 0
          if (!e) break
          if ((n | 0) == (e | 0)) {
            c[o >> 2] = f
            q = c[i >> 2] | 0
            pb[c[((c[q >> 2] | 0) + 12) >> 2] & 15](q, f)
            y = c[o >> 2] | 0
          } else {
            q = ib[c[((c[e >> 2] | 0) + 8) >> 2] & 15](e) | 0
            c[o >> 2] = q
            y = q
          }
          if (!y) {
            z = 32
            break
          }
          pb[c[((c[y >> 2] | 0) + 24) >> 2] & 15](y, k)
          q = c[o >> 2] | 0
          if ((f | 0) != (q | 0)) {
            if (q | 0) ob[c[((c[q >> 2] | 0) + 20) >> 2] & 255](q)
          } else ob[c[((c[q >> 2] | 0) + 16) >> 2] & 255](q)
          n = (n + 24) | 0
          if ((n | 0) == (p | 0)) break a
        }
        if ((z | 0) == 32) {
          A = I(4) | 0
          c[A >> 2] = 3700
          K(A | 0, 1864, 112)
        }
        c[o >> 2] = 0
        A = I(4) | 0
        c[A >> 2] = 3700
        K(A | 0, 1864, 112)
      }
    while (0)
    Yb(b)
    Zb(b)
    A = c[b >> 2] | 0
    z = (A + 12) | 0
    a[z >> 0] = 0
    a[(A + 13) >> 0] = 0
    p = ((c[(b + 116) >> 2] | 0) + 8) | 0
    f = c[(A + 4) >> 2] | 0
    k = (((f | 0) < 0) << 31) >> 31
    if ((0 < (k | 0)) | ((0 == (k | 0)) & (p >>> 0 < f >>> 0))) {
      c[(A + 8) >> 2] = p
      B = (b + 12) | 0
      c[B >> 2] = 0
      C = (b + 8) | 0
      c[C >> 2] = 0
      eb = d
      return
    } else {
      a[z >> 0] = 1
      B = (b + 12) | 0
      c[B >> 2] = 0
      C = (b + 8) | 0
      c[C >> 2] = 0
      eb = d
      return
    }
  }
  function Wb(a) {
    a = a | 0
    Eh(a, 4539)
    c[a >> 2] = 2264
    return
  }
  function Xb() {
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0
    b = eb
    eb = (eb + 32) | 0
    d = b
    if ((a[18688] | 0) == 0 ? Fi(18688) | 0 : 0) {
      c[4682] = 0
      c[4683] = 0
      c[4684] = 0
    }
    ;(a[18696] | 0) == 0 ? Fi(18696) | 0 : 0
    if ((c[4682] | 0) != (c[4683] | 0)) {
      eb = b
      return 18728
    }
    uh(18740)
    e = c[4682] | 0
    if ((e | 0) == (c[4683] | 0)) {
      f = (d + 16) | 0
      c[d >> 2] = 2284
      c[f >> 2] = d
      if (e >>> 0 < (c[4684] | 0) >>> 0) {
        c[(e + 16) >> 2] = e
        g = c[f >> 2] | 0
        pb[c[((c[g >> 2] | 0) + 12) >> 2] & 15](g, e)
        c[4683] = (c[4683] | 0) + 24
      } else $b(18728, d)
      e = c[f >> 2] | 0
      if ((d | 0) != (e | 0)) {
        if (e | 0) ob[c[((c[e >> 2] | 0) + 20) >> 2] & 255](e)
      } else ob[c[((c[e >> 2] | 0) + 16) >> 2] & 255](e)
    }
    vh(18740)
    eb = b
    return 18728
  }
  function Yb(e) {
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0,
      J = 0,
      L = 0,
      M = 0,
      N = 0,
      O = 0,
      P = 0,
      Q = 0,
      R = 0,
      S = 0,
      T = 0,
      U = 0,
      V = 0,
      W = 0,
      X = 0,
      Y = 0,
      Z = 0,
      _ = 0,
      $ = 0
    f = eb
    eb = (eb + 80) | 0
    g = (f + 12) | 0
    h = f
    i = c[e >> 2] | 0
    j = b[(e + 114) >> 1] | 0
    k = (i + 4) | 0
    l = c[k >> 2] | 0
    m = (((l | 0) < 0) << 31) >> 31
    if ((0 < (m | 0)) | ((0 == (m | 0)) & ((j & 65535) >>> 0 < l >>> 0)))
      c[(i + 8) >> 2] = j & 65535
    else a[(i + 12) >> 0] = 1
    j = c[(e + 120) >> 2] | 0
    if (!j) {
      n = I(8) | 0
      oc(n)
      K(n | 0, 768, 8)
    }
    o = (g + 2) | 0
    p = (g + 20) | 0
    q = (g + 18) | 0
    r = (i + 12) | 0
    s = (i + 13) | 0
    t = (i + 8) | 0
    u = (i + 16) | 0
    w = (g + 3) | 0
    x = (g + 4) | 0
    y = (g + 5) | 0
    z = (g + 6) | 0
    A = (g + 7) | 0
    B = (g + 8) | 0
    C = (g + 9) | 0
    D = (g + 10) | 0
    E = (g + 11) | 0
    F = (g + 12) | 0
    G = (g + 13) | 0
    H = (g + 14) | 0
    J = (g + 15) | 0
    L = 0
    M = a[r >> 0] | 0
    while (1) {
      a[r >> 0] = 0
      if ((M << 24) >> 24) {
        N = 33
        break
      }
      if (a[s >> 0] | 0) {
        N = 33
        break
      }
      O = c[t >> 2] | 0
      P = (l - O) | 0
      Q = (P | 0) < 54 ? P : 54
      if (Q | 0) Ti(g | 0, ((c[i >> 2] | 0) + O) | 0, Q | 0) | 0
      P = (O + Q) | 0
      c[t >> 2] = P
      c[u >> 2] = Q
      if ((P | 0) >= (l | 0)) a[s >> 0] = 1
      if (
        ((a[o >> 0] | 0) == 108) &
        ((a[w >> 0] | 0) == 97) &
        ((a[x >> 0] | 0) == 115) &
        ((a[y >> 0] | 0) == 122) &
        ((a[z >> 0] | 0) == 105) &
        ((a[A >> 0] | 0) == 112) &
        ((a[B >> 0] | 0) == 32) &
        ((a[C >> 0] | 0) == 101) &
        ((a[D >> 0] | 0) == 110) &
        ((a[E >> 0] | 0) == 99) &
        ((a[F >> 0] | 0) == 111) &
        ((a[G >> 0] | 0) == 100) &
        ((a[H >> 0] | 0) == 101) &
        ((a[J >> 0] | 0) == 100) &
        (((d[q >> 0] | (d[(q + 1) >> 0] << 8)) << 16) >> 16 == 22204)
      ) {
        N = 13
        break
      }
      Q =
        Mi(
          P | 0,
          ((((P | 0) < 0) << 31) >> 31) | 0,
          ((d[p >> 0] | (d[(p + 1) >> 0] << 8)) & 65535) | 0,
          0
        ) | 0
      P = v() | 0
      if (
        ((P | 0) < 0) |
        (((P | 0) > (m | 0)) | (((P | 0) == (m | 0)) & (Q >>> 0 >= l >>> 0)))
      ) {
        a[r >> 0] = 1
        R = 1
      } else {
        a[r >> 0] = 0
        c[t >> 2] = Q
        R = 0
      }
      L = (L + 1) | 0
      if (L >>> 0 >= j >>> 0) {
        N = 33
        break
      } else M = R
    }
    if ((N | 0) == 13) {
      R = (i + 16) | 0
      M = (d[p >> 0] | (d[(p + 1) >> 0] << 8)) & 65535
      p = xh(M) | 0
      if (!(a[s >> 0] | 0)) {
        j = c[k >> 2] | 0
        L = c[t >> 2] | 0
        l = (j - L) | 0
        m = (l | 0) < (M | 0) ? l : M
        if (!m) {
          S = L
          T = j
        } else {
          Ui(p | 0, ((c[i >> 2] | 0) + L) | 0, m | 0) | 0
          S = c[t >> 2] | 0
          T = c[k >> 2] | 0
        }
        k = (S + m) | 0
        c[t >> 2] = k
        c[R >> 2] = m
        if ((k | 0) >= (T | 0)) a[s >> 0] = 1
      } else a[r >> 0] = 1
      r = (p + 2) | 0
      s = (e + 247) | 0
      T = d[p >> 0] | (d[(p + 1) >> 0] << 8)
      a[s >> 0] = T
      a[(s + 1) >> 0] = T >> 8
      T = (e + 249) | 0
      k = d[r >> 0] | (d[(r + 1) >> 0] << 8)
      a[T >> 0] = k
      a[(T + 1) >> 0] = k >> 8
      a[(e + 251) >> 0] = a[(p + 4) >> 0] | 0
      k = (p + 6) | 0
      a[(e + 252) >> 0] = a[(p + 5) >> 0] | 0
      T = (p + 8) | 0
      r = (e + 253) | 0
      m = d[k >> 0] | (d[(k + 1) >> 0] << 8)
      a[r >> 0] = m
      a[(r + 1) >> 0] = m >> 8
      m = (p + 12) | 0
      r = (e + 255) | 0
      k =
        d[T >> 0] |
        (d[(T + 1) >> 0] << 8) |
        (d[(T + 2) >> 0] << 16) |
        (d[(T + 3) >> 0] << 24)
      a[r >> 0] = k
      a[(r + 1) >> 0] = k >> 8
      a[(r + 2) >> 0] = k >> 16
      a[(r + 3) >> 0] = k >> 24
      k = (e + 259) | 0
      r =
        d[m >> 0] |
        (d[(m + 1) >> 0] << 8) |
        (d[(m + 2) >> 0] << 16) |
        (d[(m + 3) >> 0] << 24)
      a[k >> 0] = r
      a[(k + 1) >> 0] = r >> 8
      a[(k + 2) >> 0] = r >> 16
      a[(k + 3) >> 0] = r >> 24
      r = (p + 16) | 0
      k = r
      m =
        d[k >> 0] |
        (d[(k + 1) >> 0] << 8) |
        (d[(k + 2) >> 0] << 16) |
        (d[(k + 3) >> 0] << 24)
      k = (r + 4) | 0
      r =
        d[k >> 0] |
        (d[(k + 1) >> 0] << 8) |
        (d[(k + 2) >> 0] << 16) |
        (d[(k + 3) >> 0] << 24)
      k = (e + 263) | 0
      T = k
      a[T >> 0] = m
      a[(T + 1) >> 0] = m >> 8
      a[(T + 2) >> 0] = m >> 16
      a[(T + 3) >> 0] = m >> 24
      m = (k + 4) | 0
      a[m >> 0] = r
      a[(m + 1) >> 0] = r >> 8
      a[(m + 2) >> 0] = r >> 16
      a[(m + 3) >> 0] = r >> 24
      r = (p + 32) | 0
      m = (p + 24) | 0
      k = m
      T =
        d[k >> 0] |
        (d[(k + 1) >> 0] << 8) |
        (d[(k + 2) >> 0] << 16) |
        (d[(k + 3) >> 0] << 24)
      k = (m + 4) | 0
      m =
        d[k >> 0] |
        (d[(k + 1) >> 0] << 8) |
        (d[(k + 2) >> 0] << 16) |
        (d[(k + 3) >> 0] << 24)
      k = (e + 271) | 0
      R = k
      a[R >> 0] = T
      a[(R + 1) >> 0] = T >> 8
      a[(R + 2) >> 0] = T >> 16
      a[(R + 3) >> 0] = T >> 24
      T = (k + 4) | 0
      a[T >> 0] = m
      a[(T + 1) >> 0] = m >> 8
      a[(T + 2) >> 0] = m >> 16
      a[(T + 3) >> 0] = m >> 24
      m = (p + 34) | 0
      T = (e + 279) | 0
      k = d[r >> 0] | (d[(r + 1) >> 0] << 8)
      a[T >> 0] = k
      a[(T + 1) >> 0] = k >> 8
      r = (e + 281) | 0
      R =
        d[r >> 0] |
        (d[(r + 1) >> 0] << 8) |
        (d[(r + 2) >> 0] << 16) |
        (d[(r + 3) >> 0] << 24)
      if (!R) U = k
      else {
        zh(R)
        U = d[T >> 0] | (d[(T + 1) >> 0] << 8)
      }
      R = xh(((U & 65535) * 6) | 0) | 0
      a[r >> 0] = R
      a[(r + 1) >> 0] = R >> 8
      a[(r + 2) >> 0] = R >> 16
      a[(r + 3) >> 0] = R >> 24
      if (
        (
          (U << 16) >> 16
            ? ((k = (p + 36) | 0),
              (t = d[m >> 0] | (d[(m + 1) >> 0] << 8)),
              (a[R >> 0] = t),
              (a[(R + 1) >> 0] = t >> 8),
              (t = (p + 38) | 0),
              (m = (R + 2) | 0),
              (S = d[k >> 0] | (d[(k + 1) >> 0] << 8)),
              (a[m >> 0] = S),
              (a[(m + 1) >> 0] = S >> 8),
              (S = (R + 4) | 0),
              (m = d[t >> 0] | (d[(t + 1) >> 0] << 8)),
              (a[S >> 0] = m),
              (a[(S + 1) >> 0] = m >> 8),
              (U << 16) >> 16 != 1)
            : 0
        )
          ? ((U = (p + 40) | 0),
            (m = (p + 42) | 0),
            (S = (R + 6) | 0),
            (t = d[U >> 0] | (d[(U + 1) >> 0] << 8)),
            (a[S >> 0] = t),
            (a[(S + 1) >> 0] = t >> 8),
            (t = (p + 44) | 0),
            (S = (R + 8) | 0),
            (k = d[m >> 0] | (d[(m + 1) >> 0] << 8)),
            (a[S >> 0] = k),
            (a[(S + 1) >> 0] = k >> 8),
            (k = (R + 10) | 0),
            (R = d[t >> 0] | (d[(t + 1) >> 0] << 8)),
            (a[k >> 0] = R),
            (a[(k + 1) >> 0] = R >> 8),
            ((d[T >> 0] | (d[(T + 1) >> 0] << 8)) & 65535) > 2)
          : 0
      ) {
        R = U
        U = 2
        do {
          k =
            d[r >> 0] |
            (d[(r + 1) >> 0] << 8) |
            (d[(r + 2) >> 0] << 16) |
            (d[(r + 3) >> 0] << 24)
          t = R
          R = (R + 6) | 0
          S = (t + 8) | 0
          m = (k + ((U * 6) | 0)) | 0
          L = d[R >> 0] | (d[(R + 1) >> 0] << 8)
          a[m >> 0] = L
          a[(m + 1) >> 0] = L >> 8
          L = (t + 10) | 0
          t = (k + ((U * 6) | 0) + 2) | 0
          m = d[S >> 0] | (d[(S + 1) >> 0] << 8)
          a[t >> 0] = m
          a[(t + 1) >> 0] = m >> 8
          m = (k + ((U * 6) | 0) + 4) | 0
          k = d[L >> 0] | (d[(L + 1) >> 0] << 8)
          a[m >> 0] = k
          a[(m + 1) >> 0] = k >> 8
          U = (U + 1) | 0
        } while (U >>> 0 < ((d[T >> 0] | (d[(T + 1) >> 0] << 8)) & 65535) >>> 0)
      }
      if (((d[s >> 0] | (d[(s + 1) >> 0] << 8)) << 16) >> 16 != 2) {
        s = I(8) | 0
        Eh(s, 5087)
        c[s >> 2] = 2368
        K(s | 0, 784, 8)
      }
      yh(p)
      p = (e + 125) | 0
      pc(h, (e + 247) | 0, (d[p >> 0] | (d[(p + 1) >> 0] << 8)) & 65535)
      p = (e + 300) | 0
      s = c[p >> 2] | 0
      if (!s) {
        V = (e + 308) | 0
        W = (e + 304) | 0
        X = c[h >> 2] | 0
        c[p >> 2] = X
        Y = (h + 4) | 0
        Z = c[Y >> 2] | 0
        c[W >> 2] = Z
        _ = (h + 8) | 0
        $ = c[_ >> 2] | 0
        c[V >> 2] = $
        eb = f
        return
      } else {
        T = (e + 304) | 0
        c[T >> 2] = s
        yh(s)
        s = (e + 308) | 0
        c[s >> 2] = 0
        c[T >> 2] = 0
        c[p >> 2] = 0
        V = s
        W = T
        X = c[h >> 2] | 0
        c[p >> 2] = X
        Y = (h + 4) | 0
        Z = c[Y >> 2] | 0
        c[W >> 2] = Z
        _ = (h + 8) | 0
        $ = c[_ >> 2] | 0
        c[V >> 2] = $
        eb = f
        return
      }
    } else if ((N | 0) == 33) {
      n = I(8) | 0
      oc(n)
      K(n | 0, 768, 8)
    }
  }
  function Zb(b) {
    b = b | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0
    e = eb
    eb = (eb + 128) | 0
    f = e
    g = (e + 120) | 0
    h = (e + 104) | 0
    i = (e + 88) | 0
    j = (e + 8) | 0
    k = c[b >> 2] | 0
    l = (b + 116) | 0
    m = c[l >> 2] | 0
    n = c[(k + 4) >> 2] | 0
    o = (((n | 0) < 0) << 31) >> 31
    if ((0 < (o | 0)) | ((0 == (o | 0)) & (m >>> 0 < n >>> 0)))
      c[(k + 8) >> 2] = m
    else a[(k + 12) >> 0] = 1
    p = f
    c[p >> 2] = 0
    c[(p + 4) >> 2] = 0
    p = (k + 13) | 0
    if (!(a[p >> 0] | 0)) {
      q = (k + 8) | 0
      r = c[q >> 2] | 0
      s = (n - r) | 0
      t = (s | 0) < 8 ? s : 8
      if (t | 0) Ti(f | 0, ((c[k >> 2] | 0) + r) | 0, t | 0) | 0
      s = (t + r) | 0
      c[q >> 2] = s
      c[(k + 16) >> 2] = t
      if ((s | 0) < (n | 0)) u = 0
      else {
        a[p >> 0] = 1
        u = 1
      }
    } else {
      a[(k + 12) >> 0] = 1
      u = 1
    }
    s = (k + 12) | 0
    t = (a[s >> 0] | 0) == 0
    a[s >> 0] = 0
    if (!t) {
      t = I(8) | 0
      tc(t)
      K(t | 0, 800, 8)
    }
    t = f
    f = c[t >> 2] | 0
    q = c[(t + 4) >> 2] | 0
    if (((f | 0) == -1) & ((q | 0) == -1)) {
      t = I(8) | 0
      uc(t, 5221)
      K(t | 0, 816, 8)
    }
    if (!(((q | 0) < (o | 0)) | (((q | 0) == (o | 0)) & (f >>> 0 < n >>> 0)))) {
      a[s >> 0] = 0
      o = I(8) | 0
      tc(o)
      K(o | 0, 800, 8)
    }
    o = (k + 8) | 0
    c[o >> 2] = f
    a[s >> 0] = 0
    if ((u << 24) >> 24) {
      a[s >> 0] = 0
      u = I(8) | 0
      tc(u)
      K(u | 0, 800, 8)
    }
    u = (n - f) | 0
    q = (u | 0) < 8 ? u : 8
    if (q | 0) Ti(g | 0, ((c[k >> 2] | 0) + f) | 0, q | 0) | 0
    u = (q + f) | 0
    c[o >> 2] = u
    c[(k + 16) >> 2] = q
    if ((u | 0) >= (n | 0)) a[p >> 0] = 1
    a[s >> 0] = 0
    if (c[g >> 2] | 0) {
      s = I(8) | 0
      vc(s)
      K(s | 0, 832, 8)
    }
    s = (b + 288) | 0
    p = c[s >> 2] | 0
    n = (b + 292) | 0
    c[n >> 2] = p
    u = (b + 259) | 0
    if (
      (d[u >> 0] |
        (d[(u + 1) >> 0] << 8) |
        (d[(u + 2) >> 0] << 16) |
        (d[(u + 3) >> 0] << 24) |
        0) ==
      -1
    ) {
      u = I(8) | 0
      uc(u, 5339)
      K(u | 0, 816, 8)
    }
    u = (g + 4) | 0
    g = c[u >> 2] | 0
    q = (g + 1) | 0
    if (q) {
      Cc(s, q)
      q = c[s >> 2] | 0
      c[q >> 2] = (c[l >> 2] | 0) + 8
      c[(q + 4) >> 2] = 0
      if (g >>> 0 > 1) w = s
      else {
        eb = e
        return
      }
    } else {
      g = p
      c[g >> 2] = m + 8
      c[(g + 4) >> 2] = 0
      w = s
    }
    c[h >> 2] = c[b >> 2]
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    b = (h + 12) | 0
    g = fh(1048644) | 0
    m = (g + 68) & -64
    c[(m + -4) >> 2] = g
    c[b >> 2] = m
    c[i >> 2] = h
    c[(i + 4) >> 2] = 0
    c[(i + 8) >> 2] = -1
    c[(j + 4) >> 2] = 32
    c[(j + 8) >> 2] = 2
    c[(j + 12) >> 2] = 8
    c[(j + 16) >> 2] = 0
    h = (j + 36) | 0
    c[h >> 2] = 0
    c[(j + 40) >> 2] = 0
    c[(j + 44) >> 2] = 0
    c[(j + 60) >> 2] = 1
    c[(j + 64) >> 2] = 2
    c[(j + 56) >> 2] = 4096
    c[(j + 52) >> 2] = 4
    c[(j + 48) >> 2] = 4
    c[(j + 68) >> 2] = 0
    c[(j + 72) >> 2] = 0
    c[(j + 76) >> 2] = 0
    c[(j + 20) >> 2] = 32
    m = (j + 24) | 0
    c[m >> 2] = 0
    c[(j + 28) >> 2] = -2147483648
    c[(j + 32) >> 2] = 2147483647
    c[j >> 2] = 0
    wc(i)
    xc(j)
    g = c[u >> 2] | 0
    if (!g) {
      u = c[s >> 2] | 0
      x = u
      y = u
    } else {
      u = 1
      do {
        if (u >>> 0 > 1) z = c[((c[w >> 2] | 0) + ((u + -1) << 3)) >> 2] | 0
        else z = 0
        s = ((Jc(j, i, ((c[h >> 2] | 0) + 44) | 0) | 0) + z) | 0
        p = c[m >> 2] | 0
        if ((s | 0) < 0) A = (p + s) | 0
        else A = (s - (s >>> 0 < p >>> 0 ? 0 : p)) | 0
        B = c[w >> 2] | 0
        p = (B + (u << 3)) | 0
        c[p >> 2] = A
        c[(p + 4) >> 2] = (((A | 0) < 0) << 31) >> 31
        u = (u + 1) | 0
      } while (u >>> 0 <= g >>> 0)
      x = B
      y = B
    }
    B = c[n >> 2] | 0
    if (((B - x) >> 3) >>> 0 > 1) {
      x = (B - y) >> 3
      B = y
      n = 1
      g = c[B >> 2] | 0
      u = c[(B + 4) >> 2] | 0
      do {
        B = (y + (n << 3)) | 0
        A = B
        g = Mi(c[A >> 2] | 0, c[(A + 4) >> 2] | 0, g | 0, u | 0) | 0
        u = v() | 0
        A = B
        c[A >> 2] = g
        c[(A + 4) >> 2] = u
        n = (n + 1) | 0
      } while (n >>> 0 < x >>> 0)
    }
    yc(j)
    gh(c[((c[b >> 2] | 0) + -4) >> 2] | 0)
    eb = e
    return
  }
  function _b(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function $b(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0
    d = (a + 4) | 0
    e = c[d >> 2] | 0
    f = c[a >> 2] | 0
    g = (((e - f) | 0) / 24) | 0
    h = (g + 1) | 0
    i = f
    j = e
    if (h >>> 0 > 178956970) Jh(a)
    e = (a + 8) | 0
    k = ((((c[e >> 2] | 0) - f) | 0) / 24) | 0
    f = k << 1
    l = k >>> 0 < 89478485 ? (f >>> 0 < h >>> 0 ? h : f) : 178956970
    do
      if (l)
        if (l >>> 0 > 178956970) {
          f = I(8) | 0
          Ch(f, 4471)
          c[f >> 2] = 3844
          K(f | 0, 2008, 119)
        } else {
          m = wh((l * 24) | 0) | 0
          break
        }
      else m = 0
    while (0)
    f = (m + ((g * 24) | 0)) | 0
    h = (m + ((l * 24) | 0)) | 0
    l = (b + 16) | 0
    k = c[l >> 2] | 0
    do
      if (k)
        if ((b | 0) == (k | 0)) {
          c[(m + ((g * 24) | 0) + 16) >> 2] = f
          pb[c[((c[k >> 2] | 0) + 12) >> 2] & 15](k, f)
          n = c[d >> 2] | 0
          o = c[a >> 2] | 0
          break
        } else {
          c[(m + ((g * 24) | 0) + 16) >> 2] = k
          c[l >> 2] = 0
          n = j
          o = i
          break
        }
      else {
        c[(m + ((g * 24) | 0) + 16) >> 2] = 0
        n = j
        o = i
      }
    while (0)
    i = (f + 24) | 0
    if ((n | 0) == (o | 0)) {
      p = f
      q = n
    } else {
      j = n
      n = f
      do {
        f = n
        n = (n + -24) | 0
        g = (j + -8) | 0
        j = (j + -24) | 0
        m = c[g >> 2] | 0
        do
          if (m)
            if ((j | 0) == (m | 0)) {
              c[(f + -8) >> 2] = n
              l = c[g >> 2] | 0
              pb[c[((c[l >> 2] | 0) + 12) >> 2] & 15](l, n)
              break
            } else {
              c[(f + -8) >> 2] = m
              c[g >> 2] = 0
              break
            }
          else c[(f + -8) >> 2] = 0
        while (0)
      } while ((j | 0) != (o | 0))
      p = n
      q = c[a >> 2] | 0
    }
    c[a >> 2] = p
    p = c[d >> 2] | 0
    c[d >> 2] = i
    c[e >> 2] = h
    if ((p | 0) != (q | 0)) {
      h = p
      do {
        p = c[(h + -8) >> 2] | 0
        h = (h + -24) | 0
        if ((h | 0) != (p | 0)) {
          if (p | 0) ob[c[((c[p >> 2] | 0) + 20) >> 2] & 255](p)
        } else ob[c[((c[p >> 2] | 0) + 16) >> 2] & 255](p)
      } while ((h | 0) != (q | 0))
    }
    if (!q) return
    yh(q)
    return
  }
  function ac(a) {
    a = a | 0
    yh(a)
    return
  }
  function bc(a) {
    a = a | 0
    a = wh(8) | 0
    c[a >> 2] = 2284
    return a | 0
  }
  function cc(a, b) {
    a = a | 0
    b = b | 0
    c[b >> 2] = 2284
    return
  }
  function dc(a) {
    a = a | 0
    return
  }
  function ec(a) {
    a = a | 0
    yh(a)
    return
  }
  function fc(a, b) {
    a = a | 0
    b = b | 0
    jc((a + 4) | 0, b)
    return
  }
  function gc(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 4931 ? (a + 4) | 0 : 0) | 0
  }
  function hc(a) {
    a = a | 0
    return 760
  }
  function ic(a) {
    a = a | 0
    return
  }
  function jc(b, c) {
    b = b | 0
    c = c | 0
    var e = 0,
      f = 0,
      g = 0
    b = (c + 104) | 0
    c = d[b >> 0] | 0
    e = c >>> 7
    f = (c >>> 6) & 1
    if (((e | 0) == 1) & ((f | 0) != 0)) {
      g = I(8) | 0
      kc(g)
      K(g | 0, 728, 8)
    }
    if ((e | 0) == (f | 0)) {
      f = I(8) | 0
      lc(f)
      K(f | 0, 744, 8)
    } else {
      a[b >> 0] = c & 63
      return
    }
  }
  function kc(a) {
    a = a | 0
    Eh(a, 4824)
    c[a >> 2] = 2328
    return
  }
  function lc(a) {
    a = a | 0
    Eh(a, 4892)
    c[a >> 2] = 2348
    return
  }
  function mc(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function nc(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function oc(a) {
    a = a | 0
    Eh(a, 5143)
    c[a >> 2] = 2388
    return
  }
  function pc(a, b, e) {
    a = a | 0
    b = b | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0
    f = eb
    eb = (eb + 16) | 0
    g = f
    c[a >> 2] = 0
    h = (a + 4) | 0
    c[h >> 2] = 0
    i = (a + 8) | 0
    c[i >> 2] = 0
    j = (b + 32) | 0
    a: do
      if (!(((d[j >> 0] | (d[(j + 1) >> 0] << 8)) << 16) >> 16)) k = e
      else {
        l = (b + 34) | 0
        m = (g + 4) | 0
        n = (g + 8) | 0
        o = e
        p = 0
        q = 0
        r = 0
        s = 0
        while (1) {
          t =
            d[l >> 0] |
            (d[(l + 1) >> 0] << 8) |
            (d[(l + 2) >> 0] << 16) |
            (d[(l + 3) >> 0] << 24)
          u = (t + ((p * 6) | 0)) | 0
          v = (t + ((p * 6) | 0) + 2) | 0
          w = (d[v >> 0] | (d[(v + 1) >> 0] << 8)) & 65535
          x = (t + ((p * 6) | 0) + 4) | 0
          t = (d[x >> 0] | (d[(x + 1) >> 0] << 8)) & 65535
          c[g >> 2] = (d[u >> 0] | (d[(u + 1) >> 0] << 8)) & 65535
          c[m >> 2] = w
          c[n >> 2] = t
          if ((q | 0) == (r | 0)) sc(a, g)
          else {
            c[s >> 2] = c[g >> 2]
            c[(s + 4) >> 2] = c[(g + 4) >> 2]
            c[(s + 8) >> 2] = c[(g + 8) >> 2]
            c[h >> 2] = (c[h >> 2] | 0) + 12
          }
          t = (o - ((d[v >> 0] | (d[(v + 1) >> 0] << 8)) & 65535)) | 0
          v = (p + 1) | 0
          if (v >>> 0 >= ((d[j >> 0] | (d[(j + 1) >> 0] << 8)) & 65535) >>> 0) {
            k = t
            break a
          }
          w = c[h >> 2] | 0
          o = t
          p = v
          q = w
          r = c[i >> 2] | 0
          s = w
        }
      }
    while (0)
    if ((k | 0) < 0) {
      j = I(8) | 0
      Eh(j, 5087)
      c[j >> 2] = 2368
      K(j | 0, 784, 8)
    }
    if (!k) {
      eb = f
      return
    }
    c[g >> 2] = 0
    c[(g + 4) >> 2] = k
    c[(g + 8) >> 2] = 2
    k = c[h >> 2] | 0
    if ((k | 0) == (c[i >> 2] | 0)) sc(a, g)
    else {
      c[k >> 2] = c[g >> 2]
      c[(k + 4) >> 2] = c[(g + 4) >> 2]
      c[(k + 8) >> 2] = c[(g + 8) >> 2]
      c[h >> 2] = (c[h >> 2] | 0) + 12
    }
    eb = f
    return
  }
  function qc(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function rc(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function sc(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0
    d = (a + 4) | 0
    e = c[a >> 2] | 0
    f = ((c[d >> 2] | 0) - e) | 0
    g = ((f | 0) / 12) | 0
    h = (g + 1) | 0
    if (h >>> 0 > 357913941) Jh(a)
    i = (a + 8) | 0
    j = ((((c[i >> 2] | 0) - e) | 0) / 12) | 0
    k = j << 1
    l = j >>> 0 < 178956970 ? (k >>> 0 < h >>> 0 ? h : k) : 357913941
    do
      if (l)
        if (l >>> 0 > 357913941) {
          k = I(8) | 0
          Ch(k, 4471)
          c[k >> 2] = 3844
          K(k | 0, 2008, 119)
        } else {
          m = wh((l * 12) | 0) | 0
          break
        }
      else m = 0
    while (0)
    k = (m + ((g * 12) | 0)) | 0
    c[k >> 2] = c[b >> 2]
    c[(k + 4) >> 2] = c[(b + 4) >> 2]
    c[(k + 8) >> 2] = c[(b + 8) >> 2]
    b = (k + (((((f | 0) / -12) | 0) * 12) | 0)) | 0
    if ((f | 0) > 0) Ti(b | 0, e | 0, f | 0) | 0
    c[a >> 2] = b
    c[d >> 2] = k + 12
    c[i >> 2] = m + ((l * 12) | 0)
    if (!e) return
    yh(e)
    return
  }
  function tc(a) {
    a = a | 0
    Eh(a, 5393)
    c[a >> 2] = 2408
    return
  }
  function uc(a, b) {
    a = a | 0
    b = b | 0
    Eh(a, b)
    c[a >> 2] = 2428
    return
  }
  function vc(a) {
    a = a | 0
    Eh(a, 5437)
    c[a >> 2] = 2448
    return
  }
  function wc(b) {
    b = b | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0,
      J = 0,
      L = 0,
      M = 0,
      N = 0,
      O = 0,
      P = 0,
      Q = 0,
      R = 0,
      S = 0,
      T = 0,
      U = 0,
      V = 0,
      W = 0,
      X = 0,
      Y = 0,
      Z = 0,
      _ = 0,
      $ = 0,
      aa = 0,
      ba = 0
    e = c[b >> 2] | 0
    f = (e + 4) | 0
    g = c[f >> 2] | 0
    h = (e + 8) | 0
    i = c[h >> 2] | 0
    do
      if ((g | 0) >= (i | 0)) {
        c[f >> 2] = 0
        j = c[e >> 2] | 0
        k = (e + 12) | 0
        l = c[k >> 2] | 0
        m = (j + 13) | 0
        if (!(a[m >> 0] | 0)) {
          n = (j + 4) | 0
          o = c[n >> 2] | 0
          p = (j + 8) | 0
          q = c[p >> 2] | 0
          r = (o - q) | 0
          s = (r | 0) < 1048576 ? r : 1048576
          if (!s) {
            t = q
            u = o
          } else {
            Ui(l | 0, ((c[j >> 2] | 0) + q) | 0, s | 0) | 0
            t = c[p >> 2] | 0
            u = c[n >> 2] | 0
          }
          n = (t + s) | 0
          c[p >> 2] = n
          c[(j + 16) >> 2] = s
          if ((n | 0) >= (u | 0)) a[m >> 0] = 1
        } else a[(j + 12) >> 0] = 1
        j = c[((c[e >> 2] | 0) + 16) >> 2] | 0
        c[h >> 2] = j
        if (!j) {
          j = I(8) | 0
          Dc(j)
          K(j | 0, 848, 8)
        } else {
          j = c[b >> 2] | 0
          m = (j + 8) | 0
          v = k
          w = m
          x = (j + 4) | 0
          y = c[f >> 2] | 0
          z = c[m >> 2] | 0
          A = j
          break
        }
      } else {
        v = (e + 12) | 0
        w = h
        x = f
        y = g
        z = i
        A = e
      }
    while (0)
    e = c[v >> 2] | 0
    c[f >> 2] = y + 1
    f = d[(e + y) >> 0] << 24
    y = c[x >> 2] | 0
    do
      if ((y | 0) >= (z | 0)) {
        c[x >> 2] = 0
        e = c[A >> 2] | 0
        v = (A + 12) | 0
        i = c[v >> 2] | 0
        g = (e + 13) | 0
        if (!(a[g >> 0] | 0)) {
          h = (e + 4) | 0
          u = c[h >> 2] | 0
          t = (e + 8) | 0
          j = c[t >> 2] | 0
          m = (u - j) | 0
          k = (m | 0) < 1048576 ? m : 1048576
          if (!k) {
            B = j
            C = u
          } else {
            Ui(i | 0, ((c[e >> 2] | 0) + j) | 0, k | 0) | 0
            B = c[t >> 2] | 0
            C = c[h >> 2] | 0
          }
          h = (B + k) | 0
          c[t >> 2] = h
          c[(e + 16) >> 2] = k
          if ((h | 0) >= (C | 0)) a[g >> 0] = 1
        } else a[(e + 12) >> 0] = 1
        e = c[((c[A >> 2] | 0) + 16) >> 2] | 0
        c[w >> 2] = e
        if (!e) {
          e = I(8) | 0
          Dc(e)
          K(e | 0, 848, 8)
        } else {
          e = c[b >> 2] | 0
          g = (e + 8) | 0
          D = v
          E = (e + 4) | 0
          F = g
          G = c[x >> 2] | 0
          H = c[g >> 2] | 0
          J = e
          break
        }
      } else {
        D = (A + 12) | 0
        E = x
        F = w
        G = y
        H = z
        J = A
      }
    while (0)
    A = c[D >> 2] | 0
    c[x >> 2] = G + 1
    x = (d[(A + G) >> 0] << 16) | f
    f = c[E >> 2] | 0
    do
      if ((f | 0) >= (H | 0)) {
        c[E >> 2] = 0
        G = c[J >> 2] | 0
        A = (J + 12) | 0
        D = c[A >> 2] | 0
        z = (G + 13) | 0
        if (!(a[z >> 0] | 0)) {
          y = (G + 4) | 0
          w = c[y >> 2] | 0
          C = (G + 8) | 0
          B = c[C >> 2] | 0
          e = (w - B) | 0
          g = (e | 0) < 1048576 ? e : 1048576
          if (!g) {
            L = w
            M = B
          } else {
            Ui(D | 0, ((c[G >> 2] | 0) + B) | 0, g | 0) | 0
            L = c[y >> 2] | 0
            M = c[C >> 2] | 0
          }
          y = (M + g) | 0
          c[C >> 2] = y
          c[(G + 16) >> 2] = g
          if ((y | 0) >= (L | 0)) a[z >> 0] = 1
        } else a[(G + 12) >> 0] = 1
        G = c[((c[J >> 2] | 0) + 16) >> 2] | 0
        c[F >> 2] = G
        if (!G) {
          G = I(8) | 0
          Dc(G)
          K(G | 0, 848, 8)
        } else {
          G = c[b >> 2] | 0
          z = (G + 8) | 0
          N = A
          O = (G + 4) | 0
          P = z
          Q = c[E >> 2] | 0
          R = c[z >> 2] | 0
          S = G
          break
        }
      } else {
        N = (J + 12) | 0
        O = E
        P = F
        Q = f
        R = H
        S = J
      }
    while (0)
    J = c[N >> 2] | 0
    c[E >> 2] = Q + 1
    E = x | (d[(J + Q) >> 0] << 8)
    Q = c[O >> 2] | 0
    if ((Q | 0) < (R | 0)) {
      T = (S + 12) | 0
      U = Q
      V = c[T >> 2] | 0
      W = (U + 1) | 0
      c[O >> 2] = W
      X = (V + U) | 0
      Y = a[X >> 0] | 0
      Z = Y & 255
      _ = E | Z
      $ = (b + 4) | 0
      c[$ >> 2] = _
      return
    }
    c[O >> 2] = 0
    Q = c[S >> 2] | 0
    R = (S + 12) | 0
    J = c[R >> 2] | 0
    x = (Q + 13) | 0
    if (!(a[x >> 0] | 0)) {
      N = (Q + 4) | 0
      H = c[N >> 2] | 0
      f = (Q + 8) | 0
      F = c[f >> 2] | 0
      L = (H - F) | 0
      M = (L | 0) < 1048576 ? L : 1048576
      if (!M) {
        aa = F
        ba = H
      } else {
        Ui(J | 0, ((c[Q >> 2] | 0) + F) | 0, M | 0) | 0
        aa = c[f >> 2] | 0
        ba = c[N >> 2] | 0
      }
      N = (aa + M) | 0
      c[f >> 2] = N
      c[(Q + 16) >> 2] = M
      if ((N | 0) >= (ba | 0)) a[x >> 0] = 1
    } else a[(Q + 12) >> 0] = 1
    Q = c[((c[S >> 2] | 0) + 16) >> 2] | 0
    c[P >> 2] = Q
    if (!Q) {
      Q = I(8) | 0
      Dc(Q)
      K(Q | 0, 848, 8)
    }
    T = R
    U = c[O >> 2] | 0
    V = c[T >> 2] | 0
    W = (U + 1) | 0
    c[O >> 2] = W
    X = (V + U) | 0
    Y = a[X >> 0] | 0
    Z = Y & 255
    _ = E | Z
    $ = (b + 4) | 0
    c[$ >> 2] = _
    return
  }
  function xc(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0
    d = eb
    eb = (eb + 48) | 0
    e = d
    f = (b + 36) | 0
    g = (b + 40) | 0
    if ((c[f >> 2] | 0) != (c[g >> 2] | 0)) {
      eb = d
      return
    }
    h = (b + 8) | 0
    if (!(c[h >> 2] | 0)) i = (b + 20) | 0
    else {
      j = (b + 20) | 0
      k = (b + 44) | 0
      l = (e + 4) | 0
      m = (e + 8) | 0
      n = (e + 12) | 0
      o = (e + 16) | 0
      p = (e + 20) | 0
      q = (e + 24) | 0
      r = (e + 28) | 0
      s = (e + 32) | 0
      t = (e + 36) | 0
      u = (e + 40) | 0
      v = 0
      do {
        Fc(e, ((c[j >> 2] | 0) + 1) | 0, 0, 0)
        w = c[g >> 2] | 0
        if (w >>> 0 >= (c[k >> 2] | 0) >>> 0) {
          Gc(f, e)
          x = c[m >> 2] | 0
          if (x | 0) gh(c[(x + -4) >> 2] | 0)
        } else {
          c[w >> 2] = c[e >> 2]
          a[(w + 4) >> 0] = a[l >> 0] | 0
          c[(w + 8) >> 2] = c[m >> 2]
          c[(w + 12) >> 2] = c[n >> 2]
          c[(w + 16) >> 2] = c[o >> 2]
          c[(w + 20) >> 2] = c[p >> 2]
          c[(w + 24) >> 2] = c[q >> 2]
          c[(w + 28) >> 2] = c[r >> 2]
          c[(w + 32) >> 2] = c[s >> 2]
          c[(w + 36) >> 2] = c[t >> 2]
          c[(w + 40) >> 2] = c[u >> 2]
          c[m >> 2] = 0
          c[(m + 4) >> 2] = 0
          c[(m + 8) >> 2] = 0
          c[g >> 2] = w + 44
        }
        w = c[n >> 2] | 0
        if (w | 0) gh(c[(w + -4) >> 2] | 0)
        w = c[o >> 2] | 0
        if (w | 0) gh(c[(w + -4) >> 2] | 0)
        v = (v + 1) | 0
      } while (v >>> 0 < (c[h >> 2] | 0) >>> 0)
      i = j
    }
    if (!(c[i >> 2] | 0)) {
      eb = d
      return
    }
    j = (b + 12) | 0
    h = (b + 72) | 0
    v = (b + 76) | 0
    o = (e + 4) | 0
    n = (e + 8) | 0
    g = (e + 12) | 0
    m = (e + 16) | 0
    u = (e + 20) | 0
    t = (e + 24) | 0
    s = (e + 28) | 0
    r = (e + 32) | 0
    q = (e + 36) | 0
    p = (e + 40) | 0
    l = (b + 68) | 0
    b = 1
    do {
      f = c[j >> 2] | 0
      Fc(e, 1 << (b >>> 0 > f >>> 0 ? f : b), 0, 0)
      f = c[h >> 2] | 0
      if (f >>> 0 >= (c[v >> 2] | 0) >>> 0) {
        Gc(l, e)
        k = c[n >> 2] | 0
        if (k | 0) gh(c[(k + -4) >> 2] | 0)
      } else {
        c[f >> 2] = c[e >> 2]
        a[(f + 4) >> 0] = a[o >> 0] | 0
        c[(f + 8) >> 2] = c[n >> 2]
        c[(f + 12) >> 2] = c[g >> 2]
        c[(f + 16) >> 2] = c[m >> 2]
        c[(f + 20) >> 2] = c[u >> 2]
        c[(f + 24) >> 2] = c[t >> 2]
        c[(f + 28) >> 2] = c[s >> 2]
        c[(f + 32) >> 2] = c[r >> 2]
        c[(f + 36) >> 2] = c[q >> 2]
        c[(f + 40) >> 2] = c[p >> 2]
        c[n >> 2] = 0
        c[(n + 4) >> 2] = 0
        c[(n + 8) >> 2] = 0
        c[h >> 2] = f + 44
      }
      f = c[g >> 2] | 0
      if (f | 0) gh(c[(f + -4) >> 2] | 0)
      f = c[m >> 2] | 0
      if (f | 0) gh(c[(f + -4) >> 2] | 0)
      b = (b + 1) | 0
    } while (b >>> 0 <= (c[i >> 2] | 0) >>> 0)
    eb = d
    return
  }
  function yc(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    b = (a + 68) | 0
    d = c[b >> 2] | 0
    if (d | 0) {
      e = (a + 72) | 0
      f = c[e >> 2] | 0
      if ((f | 0) == (d | 0)) g = d
      else {
        h = f
        do {
          f = c[(h + -36) >> 2] | 0
          if (f | 0) gh(c[(f + -4) >> 2] | 0)
          f = c[(h + -32) >> 2] | 0
          if (f | 0) gh(c[(f + -4) >> 2] | 0)
          f = c[(h + -28) >> 2] | 0
          h = (h + -44) | 0
          if (f | 0) gh(c[(f + -4) >> 2] | 0)
        } while ((h | 0) != (d | 0))
        g = c[b >> 2] | 0
      }
      c[e >> 2] = d
      yh(g)
    }
    g = (a + 36) | 0
    d = c[g >> 2] | 0
    if (!d) return
    e = (a + 40) | 0
    a = c[e >> 2] | 0
    if ((a | 0) == (d | 0)) i = d
    else {
      b = a
      do {
        a = c[(b + -36) >> 2] | 0
        if (a | 0) gh(c[(a + -4) >> 2] | 0)
        a = c[(b + -32) >> 2] | 0
        if (a | 0) gh(c[(a + -4) >> 2] | 0)
        a = c[(b + -28) >> 2] | 0
        b = (b + -44) | 0
        if (a | 0) gh(c[(a + -4) >> 2] | 0)
      } while ((b | 0) != (d | 0))
      i = c[g >> 2] | 0
    }
    c[e >> 2] = d
    yh(i)
    return
  }
  function zc(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function Ac(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function Bc(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function Cc(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0
    d = (a + 8) | 0
    e = c[d >> 2] | 0
    f = (a + 4) | 0
    g = c[f >> 2] | 0
    if (((e - g) >> 3) >>> 0 >= b >>> 0) {
      Vi(g | 0, 0, (b << 3) | 0) | 0
      c[f >> 2] = g + (b << 3)
      return
    }
    h = c[a >> 2] | 0
    i = (g - h) | 0
    g = i >> 3
    j = (g + b) | 0
    if (j >>> 0 > 536870911) Jh(a)
    k = (e - h) | 0
    e = k >> 2
    l = (k >> 3) >>> 0 < 268435455 ? (e >>> 0 < j >>> 0 ? j : e) : 536870911
    do
      if (l)
        if (l >>> 0 > 536870911) {
          e = I(8) | 0
          Ch(e, 4471)
          c[e >> 2] = 3844
          K(e | 0, 2008, 119)
        } else {
          e = wh(l << 3) | 0
          m = e
          n = e
          break
        }
      else {
        m = 0
        n = 0
      }
    while (0)
    e = (m + (g << 3)) | 0
    Vi(e | 0, 0, (b << 3) | 0) | 0
    if ((i | 0) > 0) Ti(n | 0, h | 0, i | 0) | 0
    c[a >> 2] = m
    c[f >> 2] = e + (b << 3)
    c[d >> 2] = m + (l << 3)
    if (!h) return
    yh(h)
    return
  }
  function Dc(a) {
    a = a | 0
    Eh(a, 5502)
    c[a >> 2] = 2468
    return
  }
  function Ec(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function Fc(b, d, e, f) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0
    c[b >> 2] = d
    a[(b + 4) >> 0] = e & 1
    g = (b + 8) | 0
    c[g >> 2] = 0
    h = (b + 12) | 0
    c[h >> 2] = 0
    i = (b + 16) | 0
    c[i >> 2] = 0
    if (((d + -2) | 0) >>> 0 > 2046) {
      j = I(8) | 0
      Eh(j, 5522)
      K(j | 0, 1992, 8)
    }
    c[(b + 32) >> 2] = d + -1
    if ((d >>> 0 > 16) & (e ^ 1)) {
      e = 3
      while (1)
        if ((1 << (e + 2)) >>> 0 < d >>> 0) e = (e + 1) | 0
        else break
      j = 1 << e
      c[(b + 36) >> 2] = j
      c[(b + 40) >> 2] = 15 - e
      e = fh(((j << 2) + 76) | 0) | 0
      j = (e + 68) & -64
      c[(j + -4) >> 2] = e
      c[i >> 2] = j
    } else {
      c[i >> 2] = 0
      c[(b + 40) >> 2] = 0
      c[(b + 36) >> 2] = 0
    }
    i = ((d << 2) + 68) | 0
    j = fh(i) | 0
    e = (j + 68) & -64
    c[(e + -4) >> 2] = j
    c[g >> 2] = e
    e = fh(i) | 0
    i = (e + 68) & -64
    c[(i + -4) >> 2] = e
    c[h >> 2] = i
    c[(b + 20) >> 2] = 0
    h = (b + 24) | 0
    c[h >> 2] = d
    d = i
    if (!f) {
      i = 0
      do {
        c[(d + (i << 2)) >> 2] = 1
        i = (i + 1) | 0
      } while (i >>> 0 < (c[b >> 2] | 0) >>> 0)
      Ic(b)
      k = c[b >> 2] | 0
      l = (k + 6) | 0
      m = l >>> 1
      c[h >> 2] = m
      n = (b + 28) | 0
      c[n >> 2] = m
      return
    } else {
      i = 0
      do {
        c[(d + (i << 2)) >> 2] = c[(f + (i << 2)) >> 2]
        i = (i + 1) | 0
      } while (i >>> 0 < (c[b >> 2] | 0) >>> 0)
      Ic(b)
      k = c[b >> 2] | 0
      l = (k + 6) | 0
      m = l >>> 1
      c[h >> 2] = m
      n = (b + 28) | 0
      c[n >> 2] = m
      return
    }
  }
  function Gc(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0
    e = (b + 4) | 0
    f = c[b >> 2] | 0
    g = ((((c[e >> 2] | 0) - f) | 0) / 44) | 0
    h = (g + 1) | 0
    if (h >>> 0 > 97612893) Jh(b)
    i = (b + 8) | 0
    j = ((((c[i >> 2] | 0) - f) | 0) / 44) | 0
    f = j << 1
    k = j >>> 0 < 48806446 ? (f >>> 0 < h >>> 0 ? h : f) : 97612893
    do
      if (k)
        if (k >>> 0 > 97612893) {
          f = I(8) | 0
          Ch(f, 4471)
          c[f >> 2] = 3844
          K(f | 0, 2008, 119)
        } else {
          l = wh((k * 44) | 0) | 0
          break
        }
      else l = 0
    while (0)
    f = (l + ((g * 44) | 0)) | 0
    h = (l + ((k * 44) | 0)) | 0
    c[f >> 2] = c[d >> 2]
    a[(l + ((g * 44) | 0) + 4) >> 0] = a[(d + 4) >> 0] | 0
    k = (d + 8) | 0
    c[(l + ((g * 44) | 0) + 8) >> 2] = c[k >> 2]
    c[(l + ((g * 44) | 0) + 12) >> 2] = c[(d + 12) >> 2]
    c[(l + ((g * 44) | 0) + 16) >> 2] = c[(d + 16) >> 2]
    c[(l + ((g * 44) | 0) + 20) >> 2] = c[(d + 20) >> 2]
    c[(l + ((g * 44) | 0) + 24) >> 2] = c[(d + 24) >> 2]
    c[(l + ((g * 44) | 0) + 28) >> 2] = c[(d + 28) >> 2]
    c[(l + ((g * 44) | 0) + 32) >> 2] = c[(d + 32) >> 2]
    c[(l + ((g * 44) | 0) + 36) >> 2] = c[(d + 36) >> 2]
    c[(l + ((g * 44) | 0) + 40) >> 2] = c[(d + 40) >> 2]
    c[k >> 2] = 0
    c[(k + 4) >> 2] = 0
    c[(k + 8) >> 2] = 0
    k = (f + 44) | 0
    d = c[b >> 2] | 0
    g = c[e >> 2] | 0
    if ((g | 0) == (d | 0)) {
      m = f
      n = d
      o = d
    } else {
      l = g
      g = 0
      j = f
      do {
        l = (l + -44) | 0
        Hc((j + -44) | 0, l)
        g = (g + -1) | 0
        j = (f + ((g * 44) | 0)) | 0
      } while ((l | 0) != (d | 0))
      m = j
      n = c[b >> 2] | 0
      o = c[e >> 2] | 0
    }
    c[b >> 2] = m
    c[e >> 2] = k
    c[i >> 2] = h
    h = n
    if ((o | 0) != (h | 0)) {
      i = o
      do {
        o = c[(i + -36) >> 2] | 0
        if (o | 0) gh(c[(o + -4) >> 2] | 0)
        o = c[(i + -32) >> 2] | 0
        if (o | 0) gh(c[(o + -4) >> 2] | 0)
        o = c[(i + -28) >> 2] | 0
        i = (i + -44) | 0
        if (o | 0) gh(c[(o + -4) >> 2] | 0)
      } while ((i | 0) != (h | 0))
    }
    if (!n) return
    yh(n)
    return
  }
  function Hc(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    e = c[d >> 2] | 0
    c[b >> 2] = e
    a[(b + 4) >> 0] = a[(d + 4) >> 0] | 0
    c[(b + 20) >> 2] = c[(d + 20) >> 2]
    c[(b + 24) >> 2] = c[(d + 24) >> 2]
    c[(b + 28) >> 2] = c[(d + 28) >> 2]
    c[(b + 32) >> 2] = c[(d + 32) >> 2]
    f = (b + 36) | 0
    c[f >> 2] = c[(d + 36) >> 2]
    c[(b + 40) >> 2] = c[(d + 40) >> 2]
    g = e << 2
    h = (g + 68) | 0
    i = fh(h) | 0
    j = (i + 68) & -64
    c[(j + -4) >> 2] = i
    i = j
    c[(b + 8) >> 2] = i
    if (e | 0) Ui(i | 0, c[(d + 8) >> 2] | 0, g | 0) | 0
    g = fh(h) | 0
    h = (g + 68) & -64
    c[(h + -4) >> 2] = g
    g = h
    c[(b + 12) >> 2] = g
    h = c[b >> 2] | 0
    if (h | 0) Ui(g | 0, c[(d + 12) >> 2] | 0, (h << 2) | 0) | 0
    h = c[f >> 2] | 0
    if (!h) {
      c[(b + 16) >> 2] = 0
      return
    }
    f = h << 2
    h = fh((f + 76) | 0) | 0
    g = (h + 68) & -64
    c[(g + -4) >> 2] = h
    h = g
    c[(b + 16) >> 2] = h
    b = (f + 8) | 0
    if (!b) return
    Ui(h | 0, c[(d + 16) >> 2] | 0, b | 0) | 0
    return
  }
  function Ic(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0
    d = (b + 24) | 0
    e = (b + 20) | 0
    f = ((c[e >> 2] | 0) + (c[d >> 2] | 0)) | 0
    c[e >> 2] = f
    if (f >>> 0 > 32768) {
      c[e >> 2] = 0
      if (!(c[b >> 2] | 0)) g = 0
      else {
        h = c[(b + 12) >> 2] | 0
        i = 0
        do {
          j = (h + (i << 2)) | 0
          k = (((c[j >> 2] | 0) + 1) | 0) >>> 1
          c[j >> 2] = k
          j = ((c[e >> 2] | 0) + k) | 0
          c[e >> 2] = j
          i = (i + 1) | 0
        } while (i >>> 0 < (c[b >> 2] | 0) >>> 0)
        g = j
      }
    } else g = f
    f = (2147483648 / (g >>> 0)) | 0
    do
      if (
        (a[(b + 4) >> 0] | 0) == 0
          ? ((g = (b + 36) | 0), (c[g >> 2] | 0) != 0)
          : 0
      ) {
        if (c[b >> 2] | 0) {
          i = c[(b + 8) >> 2] | 0
          e = c[(b + 12) >> 2] | 0
          h = (b + 40) | 0
          j = (b + 16) | 0
          k = 0
          l = 0
          m = 0
          while (1) {
            n = (r(l, f) | 0) >>> 16
            c[(i + (m << 2)) >> 2] = n
            l = ((c[(e + (m << 2)) >> 2] | 0) + l) | 0
            o = n >>> (c[h >> 2] | 0)
            if (k >>> 0 < o >>> 0) {
              n = (m + -1) | 0
              p = c[j >> 2] | 0
              q = k
              do {
                q = (q + 1) | 0
                c[(p + (q << 2)) >> 2] = n
              } while ((q | 0) != (o | 0))
              s = o
            } else s = k
            m = (m + 1) | 0
            if (m >>> 0 >= (c[b >> 2] | 0) >>> 0) break
            else k = s
          }
          k = c[j >> 2] | 0
          c[k >> 2] = 0
          if (s >>> 0 > (c[g >> 2] | 0) >>> 0) {
            t = b
            break
          } else {
            u = s
            v = k
          }
        } else {
          k = c[(b + 16) >> 2] | 0
          c[k >> 2] = 0
          u = 0
          v = k
        }
        k = u
        do {
          k = (k + 1) | 0
          c[(v + (k << 2)) >> 2] = (c[b >> 2] | 0) + -1
        } while (k >>> 0 <= (c[g >> 2] | 0) >>> 0)
        t = b
      } else w = 7
    while (0)
    if ((w | 0) == 7)
      if (!(c[b >> 2] | 0)) t = b
      else {
        w = c[(b + 8) >> 2] | 0
        v = c[(b + 12) >> 2] | 0
        u = 0
        s = 0
        do {
          c[(w + (u << 2)) >> 2] = (r(s, f) | 0) >>> 16
          s = ((c[(v + (u << 2)) >> 2] | 0) + s) | 0
          u = (u + 1) | 0
        } while (u >>> 0 < (c[b >> 2] | 0) >>> 0)
        t = b
      }
    u = (((c[d >> 2] | 0) * 5) | 0) >>> 2
    s = ((c[t >> 2] << 3) + 48) | 0
    t = u >>> 0 > s >>> 0 ? s : u
    c[d >> 2] = t
    c[(b + 28) >> 2] = t
    return
  }
  function Jc(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0
    e = Kc(b, d) | 0
    c[a >> 2] = e
    if (!e) {
      f = Mc(b, (a + 48) | 0) | 0
      return f | 0
    }
    if (e >>> 0 >= 32) {
      f = c[(a + 28) >> 2] | 0
      return f | 0
    }
    d = c[(a + 12) >> 2] | 0
    if (e >>> 0 > d >>> 0) {
      g = (e - d) | 0
      d = Kc(b, ((c[(a + 68) >> 2] | 0) + ((((e + -1) | 0) * 44) | 0)) | 0) | 0
      h = (d << g) | (Lc(b, g) | 0)
    } else
      h = Kc(b, ((c[(a + 68) >> 2] | 0) + ((((e + -1) | 0) * 44) | 0)) | 0) | 0
    e = c[a >> 2] | 0
    if ((h | 0) < ((1 << (e + -1)) | 0)) {
      f = (h + 1 + (-1 << e)) | 0
      return f | 0
    } else {
      f = (h + 1) | 0
      return f | 0
    }
    return 0
  }
  function Kc(b, e) {
    b = b | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0
    f = (b + 8) | 0
    g = c[f >> 2] | 0
    h = c[(e + 16) >> 2] | 0
    if (h) {
      i = (b + 4) | 0
      j = c[i >> 2] | 0
      k = g >>> 15
      c[f >> 2] = k
      l = ((j >>> 0) / (k >>> 0)) | 0
      m = l >>> (c[(e + 40) >> 2] | 0)
      n = c[(h + (m << 2)) >> 2] | 0
      o = ((c[(h + ((m + 1) << 2)) >> 2] | 0) + 1) | 0
      m = (n + 1) | 0
      h = c[(e + 8) >> 2] | 0
      if (o >>> 0 > m >>> 0) {
        p = n
        q = o
        while (1) {
          o = ((q + p) | 0) >>> 1
          s = (c[(h + (o << 2)) >> 2] | 0) >>> 0 > l >>> 0
          t = s ? p : o
          q = s ? o : q
          o = (t + 1) | 0
          if (q >>> 0 <= o >>> 0) {
            u = t
            v = o
            break
          } else p = t
        }
      } else {
        u = n
        v = m
      }
      m = r(c[(h + (u << 2)) >> 2] | 0, k) | 0
      if ((u | 0) == (c[(e + 32) >> 2] | 0)) {
        w = m
        x = g
        y = u
        z = i
        A = j
      } else {
        w = m
        x = r(c[(h + (v << 2)) >> 2] | 0, k) | 0
        y = u
        z = i
        A = j
      }
    } else {
      j = g >>> 15
      c[f >> 2] = j
      i = c[e >> 2] | 0
      u = c[(e + 8) >> 2] | 0
      k = (b + 4) | 0
      v = c[k >> 2] | 0
      h = i >>> 1
      m = 0
      n = g
      g = i
      i = 0
      while (1) {
        p = r(c[(u + (h << 2)) >> 2] | 0, j) | 0
        q = p >>> 0 > v >>> 0
        l = q ? p : n
        t = q ? m : p
        p = q ? i : h
        g = q ? h : g
        h = ((p + g) | 0) >>> 1
        if ((h | 0) == (p | 0)) {
          w = t
          x = l
          y = p
          z = k
          A = v
          break
        } else {
          m = t
          n = l
          i = p
        }
      }
    }
    i = (A - w) | 0
    c[z >> 2] = i
    A = (x - w) | 0
    c[f >> 2] = A
    a: do
      if (A >>> 0 < 16777216) {
        w = A
        x = i
        while (1) {
          n = x << 8
          m = c[b >> 2] | 0
          v = (m + 4) | 0
          k = c[v >> 2] | 0
          h = (m + 8) | 0
          if ((k | 0) < (c[h >> 2] | 0)) {
            B = (m + 12) | 0
            C = w
            D = k
          } else {
            c[v >> 2] = 0
            k = c[m >> 2] | 0
            g = (m + 12) | 0
            j = c[g >> 2] | 0
            u = (k + 13) | 0
            if (!(a[u >> 0] | 0)) {
              p = (k + 4) | 0
              l = c[p >> 2] | 0
              t = (k + 8) | 0
              q = c[t >> 2] | 0
              o = (l - q) | 0
              s = (o | 0) < 1048576 ? o : 1048576
              if (!s) {
                E = q
                F = l
              } else {
                Ui(j | 0, ((c[k >> 2] | 0) + q) | 0, s | 0) | 0
                E = c[t >> 2] | 0
                F = c[p >> 2] | 0
              }
              p = (E + s) | 0
              c[t >> 2] = p
              c[(k + 16) >> 2] = s
              if ((p | 0) >= (F | 0)) a[u >> 0] = 1
            } else a[(k + 12) >> 0] = 1
            k = c[((c[m >> 2] | 0) + 16) >> 2] | 0
            c[h >> 2] = k
            if (!k) break
            B = g
            C = c[f >> 2] | 0
            D = c[v >> 2] | 0
          }
          g = c[B >> 2] | 0
          c[v >> 2] = D + 1
          x = n | d[(g + D) >> 0]
          c[z >> 2] = x
          w = C << 8
          c[f >> 2] = w
          if (w >>> 0 >= 16777216) break a
        }
        w = I(8) | 0
        Dc(w)
        K(w | 0, 848, 8)
      }
    while (0)
    f = ((c[(e + 12) >> 2] | 0) + (y << 2)) | 0
    c[f >> 2] = (c[f >> 2] | 0) + 1
    f = (e + 28) | 0
    C = ((c[f >> 2] | 0) + -1) | 0
    c[f >> 2] = C
    if (C | 0) return y | 0
    Ic(e)
    return y | 0
  }
  function Lc(b, e) {
    b = b | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0
    if (e >>> 0 > 19) {
      f = (Nc(b) | 0) & 65535
      return ((Lc(b, (e + -16) | 0) | 0) << 16) | f | 0
    }
    f = (b + 4) | 0
    g = c[f >> 2] | 0
    h = (b + 8) | 0
    i = (c[h >> 2] | 0) >>> e
    c[h >> 2] = i
    e = ((g >>> 0) / (i >>> 0)) | 0
    j = (g - (r(e, i) | 0)) | 0
    c[f >> 2] = j
    if (i >>> 0 >= 16777216) return e | 0
    g = j
    j = i
    while (1) {
      i = g << 8
      k = c[b >> 2] | 0
      l = (k + 4) | 0
      m = c[l >> 2] | 0
      n = (k + 8) | 0
      if ((m | 0) < (c[n >> 2] | 0)) {
        o = (k + 12) | 0
        p = m
        q = j
      } else {
        c[l >> 2] = 0
        m = c[k >> 2] | 0
        s = (k + 12) | 0
        t = c[s >> 2] | 0
        u = (m + 13) | 0
        if (!(a[u >> 0] | 0)) {
          v = (m + 4) | 0
          w = c[v >> 2] | 0
          x = (m + 8) | 0
          y = c[x >> 2] | 0
          z = (w - y) | 0
          A = (z | 0) < 1048576 ? z : 1048576
          if (!A) {
            B = y
            C = w
          } else {
            Ui(t | 0, ((c[m >> 2] | 0) + y) | 0, A | 0) | 0
            B = c[x >> 2] | 0
            C = c[v >> 2] | 0
          }
          v = (B + A) | 0
          c[x >> 2] = v
          c[(m + 16) >> 2] = A
          if ((v | 0) >= (C | 0)) a[u >> 0] = 1
        } else a[(m + 12) >> 0] = 1
        m = c[((c[k >> 2] | 0) + 16) >> 2] | 0
        c[n >> 2] = m
        if (!m) {
          D = 15
          break
        }
        o = s
        p = c[l >> 2] | 0
        q = c[h >> 2] | 0
      }
      s = c[o >> 2] | 0
      c[l >> 2] = p + 1
      g = i | d[(s + p) >> 0]
      c[f >> 2] = g
      j = q << 8
      c[h >> 2] = j
      if (j >>> 0 >= 16777216) {
        D = 17
        break
      }
    }
    if ((D | 0) == 15) {
      j = I(8) | 0
      Dc(j)
      K(j | 0, 848, 8)
    } else if ((D | 0) == 17) return e | 0
    return 0
  }
  function Mc(b, e) {
    b = b | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0,
      J = 0
    f = (e + 8) | 0
    g = (b + 8) | 0
    h = c[g >> 2] | 0
    i = r(h >>> 13, c[f >> 2] | 0) | 0
    j = (b + 4) | 0
    k = c[j >> 2] | 0
    l = k >>> 0 >= i >>> 0
    m = l & 1
    if (l) {
      l = (k - i) | 0
      c[j >> 2] = l
      n = (h - i) | 0
      c[g >> 2] = n
      o = l
      p = n
    } else {
      c[g >> 2] = i
      n = (e + 12) | 0
      c[n >> 2] = (c[n >> 2] | 0) + 1
      o = k
      p = i
    }
    a: do
      if (p >>> 0 < 16777216) {
        i = o
        k = p
        while (1) {
          n = i << 8
          l = c[b >> 2] | 0
          h = (l + 4) | 0
          q = c[h >> 2] | 0
          s = (l + 8) | 0
          if ((q | 0) < (c[s >> 2] | 0)) {
            t = (l + 12) | 0
            u = q
            v = k
          } else {
            c[h >> 2] = 0
            q = c[l >> 2] | 0
            w = (l + 12) | 0
            x = c[w >> 2] | 0
            y = (q + 13) | 0
            if (!(a[y >> 0] | 0)) {
              z = (q + 4) | 0
              A = c[z >> 2] | 0
              B = (q + 8) | 0
              C = c[B >> 2] | 0
              D = (A - C) | 0
              E = (D | 0) < 1048576 ? D : 1048576
              if (!E) {
                F = C
                G = A
              } else {
                Ui(x | 0, ((c[q >> 2] | 0) + C) | 0, E | 0) | 0
                F = c[B >> 2] | 0
                G = c[z >> 2] | 0
              }
              z = (F + E) | 0
              c[B >> 2] = z
              c[(q + 16) >> 2] = E
              if ((z | 0) >= (G | 0)) a[y >> 0] = 1
            } else a[(q + 12) >> 0] = 1
            q = c[((c[l >> 2] | 0) + 16) >> 2] | 0
            c[s >> 2] = q
            if (!q) break
            t = w
            u = c[h >> 2] | 0
            v = c[g >> 2] | 0
          }
          w = c[t >> 2] | 0
          c[h >> 2] = u + 1
          i = n | d[(w + u) >> 0]
          c[j >> 2] = i
          k = v << 8
          c[g >> 2] = k
          if (k >>> 0 >= 16777216) break a
        }
        k = I(8) | 0
        Dc(k)
        K(k | 0, 848, 8)
      }
    while (0)
    g = (e + 4) | 0
    v = ((c[g >> 2] | 0) + -1) | 0
    c[g >> 2] = v
    if (v | 0) return m | 0
    v = c[e >> 2] | 0
    j = (e + 16) | 0
    u = ((c[j >> 2] | 0) + v) | 0
    c[j >> 2] = u
    if (u >>> 0 > 8192) {
      t = ((u + 1) | 0) >>> 1
      c[j >> 2] = t
      G = (e + 12) | 0
      F = (((c[G >> 2] | 0) + 1) | 0) >>> 1
      c[G >> 2] = F
      G = (t + 1) | 0
      if ((F | 0) == (t | 0)) {
        c[j >> 2] = G
        H = G
        J = t
      } else {
        H = t
        J = F
      }
    } else {
      H = u
      J = c[(e + 12) >> 2] | 0
    }
    c[f >> 2] = (r((2147483648 / (H >>> 0)) | 0, J) | 0) >>> 18
    J = (v * 5) | 0
    v = J >>> 0 > 259 ? 64 : J >>> 2
    c[e >> 2] = v
    c[g >> 2] = v
    return m | 0
  }
  function Nc(b) {
    b = b | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0
    e = (b + 4) | 0
    f = c[e >> 2] | 0
    g = (b + 8) | 0
    h = (c[g >> 2] | 0) >>> 16
    c[g >> 2] = h
    i = ((f >>> 0) / (h >>> 0)) | 0
    j = (f - (r(i, h) | 0)) | 0
    c[e >> 2] = j
    f = j
    j = h
    while (1) {
      h = f << 8
      k = c[b >> 2] | 0
      l = (k + 4) | 0
      m = c[l >> 2] | 0
      n = (k + 8) | 0
      if ((m | 0) < (c[n >> 2] | 0)) {
        o = (k + 12) | 0
        p = m
        q = j
      } else {
        c[l >> 2] = 0
        m = c[k >> 2] | 0
        s = (k + 12) | 0
        t = c[s >> 2] | 0
        u = (m + 13) | 0
        if (!(a[u >> 0] | 0)) {
          v = (m + 4) | 0
          w = c[v >> 2] | 0
          x = (m + 8) | 0
          y = c[x >> 2] | 0
          z = (w - y) | 0
          A = (z | 0) < 1048576 ? z : 1048576
          if (!A) {
            B = y
            C = w
          } else {
            Ui(t | 0, ((c[m >> 2] | 0) + y) | 0, A | 0) | 0
            B = c[x >> 2] | 0
            C = c[v >> 2] | 0
          }
          v = (B + A) | 0
          c[x >> 2] = v
          c[(m + 16) >> 2] = A
          if ((v | 0) >= (C | 0)) a[u >> 0] = 1
        } else a[(m + 12) >> 0] = 1
        m = c[((c[k >> 2] | 0) + 16) >> 2] | 0
        c[n >> 2] = m
        if (!m) {
          D = 12
          break
        }
        o = s
        p = c[l >> 2] | 0
        q = c[g >> 2] | 0
      }
      s = c[o >> 2] | 0
      c[l >> 2] = p + 1
      f = h | d[(s + p) >> 0]
      c[e >> 2] = f
      j = q << 8
      c[g >> 2] = j
      if (j >>> 0 >= 16777216) {
        D = 14
        break
      }
    }
    if ((D | 0) == 12) {
      j = I(8) | 0
      Dc(j)
      K(j | 0, 848, 8)
    } else if ((D | 0) == 14) return (i & 65535) | 0
    return 0
  }
  function Oc(a, b) {
    a = a | 0
    b = b | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0
    e = eb
    eb = (eb + 16) | 0
    f = e
    g = (e + 8) | 0
    h = (a + 336) | 0
    i = h
    j = (a + 259) | 0
    if (
      (
        !((c[(i + 4) >> 2] | 0) == 0
          ? (c[i >> 2] | 0) ==
            (d[j >> 0] |
              (d[(j + 1) >> 0] << 8) |
              (d[(j + 2) >> 0] << 16) |
              (d[(j + 3) >> 0] << 24) |
              0)
          : 0)
          ? ((j = c[(a + 320) >> 2] | 0), j | 0)
          : 0
      )
        ? c[(a + 312) >> 2] | 0
        : 0
    ) {
      k = j
      l = c[k >> 2] | 0
      m = c[l >> 2] | 0
      kb[m & 63](k, b) | 0
      n = h
      o = n
      p = c[o >> 2] | 0
      q = (n + 4) | 0
      r = q
      s = c[r >> 2] | 0
      t = Mi(p | 0, s | 0, 1, 0) | 0
      u = v() | 0
      w = h
      x = w
      c[x >> 2] = t
      y = (w + 4) | 0
      z = y
      c[z >> 2] = u
      eb = e
      return
    }
    j = (a + 320) | 0
    c[j >> 2] = 0
    i = (a + 324) | 0
    A = c[i >> 2] | 0
    c[i >> 2] = 0
    if (
      A | 0
        ? ((B = (A + 4) | 0),
          (C = c[B >> 2] | 0),
          (c[B >> 2] = C + -1),
          (C | 0) == 0)
        : 0
    ) {
      ob[c[((c[A >> 2] | 0) + 8) >> 2] & 255](A)
      th(A)
    }
    A = (a + 312) | 0
    c[A >> 2] = 0
    C = (a + 316) | 0
    B = c[C >> 2] | 0
    c[C >> 2] = 0
    if (
      B | 0
        ? ((D = (B + 4) | 0),
          (E = c[D >> 2] | 0),
          (c[D >> 2] = E + -1),
          (E | 0) == 0)
        : 0
    ) {
      ob[c[((c[B >> 2] | 0) + 8) >> 2] & 255](B)
      th(B)
    }
    B = wh(12) | 0
    c[B >> 2] = a + 4
    c[(B + 4) >> 2] = 0
    c[(B + 8) >> 2] = -1
    c[g >> 2] = B
    E = wh(16) | 0
    c[(E + 4) >> 2] = 0
    c[(E + 8) >> 2] = 0
    c[E >> 2] = 2488
    c[(E + 12) >> 2] = B
    D = (g + 4) | 0
    c[D >> 2] = E
    c[f >> 2] = B
    c[(f + 4) >> 2] = B
    Qc(g, f)
    B = c[g >> 2] | 0
    c[g >> 2] = c[A >> 2]
    c[A >> 2] = B
    B = c[D >> 2] | 0
    g = c[C >> 2] | 0
    c[D >> 2] = g
    c[C >> 2] = B
    B = g
    if (
      g | 0
        ? ((C = (B + 4) | 0),
          (D = c[C >> 2] | 0),
          (c[C >> 2] = D + -1),
          (D | 0) == 0)
        : 0
    ) {
      ob[c[((c[g >> 2] | 0) + 8) >> 2] & 255](B)
      th(B)
    }
    Pc(f, c[A >> 2] | 0, (a + 300) | 0)
    A = c[f >> 2] | 0
    B = (f + 4) | 0
    g = c[B >> 2] | 0
    c[f >> 2] = 0
    c[B >> 2] = 0
    c[j >> 2] = A
    A = c[i >> 2] | 0
    c[i >> 2] = g
    if (A | 0) {
      g = (A + 4) | 0
      i = c[g >> 2] | 0
      c[g >> 2] = i + -1
      if (!i) {
        ob[c[((c[A >> 2] | 0) + 8) >> 2] & 255](A)
        th(A)
      }
      A = c[B >> 2] | 0
      if (
        A | 0
          ? ((B = (A + 4) | 0),
            (i = c[B >> 2] | 0),
            (c[B >> 2] = i + -1),
            (i | 0) == 0)
          : 0
      ) {
        ob[c[((c[A >> 2] | 0) + 8) >> 2] & 255](A)
        th(A)
      }
    }
    A = (a + 328) | 0
    i = A
    B = Mi(c[i >> 2] | 0, c[(i + 4) >> 2] | 0, 1, 0) | 0
    i = v() | 0
    g = A
    c[g >> 2] = B
    c[(g + 4) >> 2] = i
    i = h
    c[i >> 2] = 0
    c[(i + 4) >> 2] = 0
    k = c[(a + 320) >> 2] | 0
    l = c[k >> 2] | 0
    m = c[l >> 2] | 0
    kb[m & 63](k, b) | 0
    n = h
    o = n
    p = c[o >> 2] | 0
    q = (n + 4) | 0
    r = q
    s = c[r >> 2] | 0
    t = Mi(p | 0, s | 0, 1, 0) | 0
    u = v() | 0
    w = h
    x = w
    c[x >> 2] = t
    y = (w + 4) | 0
    z = y
    c[z >> 2] = u
    eb = e
    return
  }
  function Pc(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0
    f = eb
    eb = (eb + 96) | 0
    g = (f + 80) | 0
    h = (f + 72) | 0
    i = (f + 64) | 0
    j = (f + 56) | 0
    k = f
    l = (f + 88) | 0
    m = Vc(e) | 0
    if ((m | 0) == -1) {
      n = I(8) | 0
      Wc(n)
      K(n | 0, 880, 8)
    }
    n = c[(e + 4) >> 2] | 0
    if (
      (
        (
          (n | 0) != (c[e >> 2] | 0)
            ? ((e = n), (c[(e + -12) >> 2] | 0) == 0)
            : 0
        )
          ? (c[(e + -4) >> 2] | 0) == 2
          : 0
      )
        ? ((n = c[(e + -8) >> 2] | 0), n | 0)
        : 0
    ) {
      e = wh(24) | 0
      c[e >> 2] = 2536
      c[(e + 4) >> 2] = d
      c[(e + 8) >> 2] = 0
      c[(e + 12) >> 2] = 0
      c[(e + 16) >> 2] = 0
      a[(e + 20) >> 0] = 1
      c[l >> 2] = e
      o = wh(16) | 0
      c[(o + 4) >> 2] = 0
      c[(o + 8) >> 2] = 0
      c[o >> 2] = 2556
      c[(o + 12) >> 2] = e
      p = (l + 4) | 0
      c[p >> 2] = o
      c[k >> 2] = e
      c[(k + 4) >> 2] = e
      fd(l, k)
      Xc(c[l >> 2] | 0)
      if ((m | 2 | 0) == 3) Yc(c[l >> 2] | 0)
      if ((m | 1 | 0) == 3) Zc(c[l >> 2] | 0)
      e = c[l >> 2] | 0
      $c(k, n)
      _c(e, k)
      e = (k + 32) | 0
      fe(e)
      n = (k + 36) | 0
      o = c[n >> 2] | 0
      q = (k + 40) | 0
      r = c[q >> 2] | 0
      if ((o | 0) != (r | 0)) {
        s = o
        do {
          yh(c[s >> 2] | 0)
          s = (s + 4) | 0
        } while ((s | 0) != (r | 0))
        r = c[n >> 2] | 0
        n = c[q >> 2] | 0
        if ((n | 0) != (r | 0))
          c[q >> 2] = n + (~(((n + -4 - r) | 0) >>> 2) << 2)
      }
      r = c[e >> 2] | 0
      if (r | 0) yh(r)
      r = c[(k + 20) >> 2] | 0
      if (r | 0) {
        c[(k + 24) >> 2] = r
        yh(r)
      }
      r = c[(k + 8) >> 2] | 0
      if (r | 0) {
        c[(k + 12) >> 2] = r
        yh(r)
      }
      c[b >> 2] = c[l >> 2]
      c[(b + 4) >> 2] = c[p >> 2]
      eb = f
      return
    }
    switch (m | 0) {
      case 0: {
        m = wh(4788) | 0
        ld(m)
        a[(m + 4784) >> 0] = 1
        p = wh(12) | 0
        c[p >> 2] = 2792
        c[(p + 4) >> 2] = d
        c[(p + 8) >> 2] = m
        c[b >> 2] = p
        m = wh(16) | 0
        c[(m + 4) >> 2] = 0
        c[(m + 8) >> 2] = 0
        c[m >> 2] = 2812
        c[(m + 12) >> 2] = p
        c[(b + 4) >> 2] = m
        c[j >> 2] = p
        c[(j + 4) >> 2] = p
        ne(b, j)
        eb = f
        return
      }
      case 1: {
        j = wh(5116) | 0
        ld(j)
        Fd((j + 4784) | 0)
        c[(j + 4952) >> 2] = 32
        c[(j + 4956) >> 2] = 9
        c[(j + 4960) >> 2] = 8
        c[(j + 4964) >> 2] = 0
        c[(j + 4984) >> 2] = 0
        c[(j + 4988) >> 2] = 0
        c[(j + 4992) >> 2] = 0
        c[(j + 5008) >> 2] = 1
        c[(j + 5012) >> 2] = 2
        c[(j + 5004) >> 2] = 4096
        c[(j + 5e3) >> 2] = 4
        c[(j + 4996) >> 2] = 4
        c[(j + 5016) >> 2] = 0
        c[(j + 5020) >> 2] = 0
        c[(j + 5024) >> 2] = 0
        c[(j + 4968) >> 2] = 32
        c[(j + 4972) >> 2] = 0
        c[(j + 4976) >> 2] = -2147483648
        c[(j + 4980) >> 2] = 2147483647
        c[(j + 4948) >> 2] = 0
        c[(j + 5032) >> 2] = 32
        c[(j + 5036) >> 2] = 9
        c[(j + 5040) >> 2] = 8
        c[(j + 5044) >> 2] = 0
        c[(j + 5064) >> 2] = 0
        c[(j + 5068) >> 2] = 0
        c[(j + 5072) >> 2] = 0
        c[(j + 5088) >> 2] = 1
        c[(j + 5092) >> 2] = 2
        c[(j + 5084) >> 2] = 4096
        c[(j + 5080) >> 2] = 4
        c[(j + 5076) >> 2] = 4
        c[(j + 5096) >> 2] = 0
        c[(j + 5100) >> 2] = 0
        c[(j + 5104) >> 2] = 0
        c[(j + 5048) >> 2] = 32
        c[(j + 5052) >> 2] = 0
        c[(j + 5056) >> 2] = -2147483648
        c[(j + 5060) >> 2] = 2147483647
        c[(j + 5028) >> 2] = 0
        a[(j + 5108) >> 0] = 0
        a[(j + 5109) >> 0] = 0
        a[(j + 5112) >> 0] = 1
        p = wh(12) | 0
        c[p >> 2] = 2840
        c[(p + 4) >> 2] = d
        c[(p + 8) >> 2] = j
        c[b >> 2] = p
        j = wh(16) | 0
        c[(j + 4) >> 2] = 0
        c[(j + 8) >> 2] = 0
        c[j >> 2] = 2860
        c[(j + 12) >> 2] = p
        c[(b + 4) >> 2] = j
        c[i >> 2] = p
        c[(i + 4) >> 2] = p
        ne(b, i)
        eb = f
        return
      }
      case 2: {
        i = wh(5104) | 0
        ld(i)
        Md((i + 4784) | 0)
        a[(i + 5100) >> 0] = 1
        p = wh(12) | 0
        c[p >> 2] = 2888
        c[(p + 4) >> 2] = d
        c[(p + 8) >> 2] = i
        c[b >> 2] = p
        i = wh(16) | 0
        c[(i + 4) >> 2] = 0
        c[(i + 8) >> 2] = 0
        c[i >> 2] = 2908
        c[(i + 12) >> 2] = p
        c[(b + 4) >> 2] = i
        c[h >> 2] = p
        c[(h + 4) >> 2] = p
        ne(b, h)
        eb = f
        return
      }
      case 3: {
        h = wh(5432) | 0
        ad(h)
        p = wh(12) | 0
        c[p >> 2] = 2936
        c[(p + 4) >> 2] = d
        c[(p + 8) >> 2] = h
        c[b >> 2] = p
        h = wh(16) | 0
        c[(h + 4) >> 2] = 0
        c[(h + 8) >> 2] = 0
        c[h >> 2] = 2956
        c[(h + 12) >> 2] = p
        c[(b + 4) >> 2] = h
        c[g >> 2] = p
        c[(g + 4) >> 2] = p
        ne(b, g)
        eb = f
        return
      }
      default: {
        c[b >> 2] = 0
        c[(b + 4) >> 2] = 0
        eb = f
        return
      }
    }
  }
  function Qc(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function Rc(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Sc(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    yh(b)
    return
  }
  function Tc(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 5716 ? (a + 12) | 0 : 0) | 0
  }
  function Uc(a) {
    a = a | 0
    yh(a)
    return
  }
  function Vc(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    d = c[(b + 4) >> 2] | 0
    e = c[b >> 2] | 0
    f = (d - e) | 0
    g = ((f | 0) / 12) | 0
    h = e
    if (!f) {
      i = -1
      return i | 0
    }
    if (
      (
        ((d | 0) != (e | 0) ? ((e = d), (c[(e + -12) >> 2] | 0) == 0) : 0)
          ? (c[(e + -4) >> 2] | 0) == 2
          : 0
      )
        ? ((d = (g + -1) | 0), (c[(e + -8) >> 2] | 0) != 0)
        : 0
    )
      if (!d) {
        i = -1
        return i | 0
      } else j = d
    else j = g
    if ((a[18704] | 0) == 0 ? Fi(18704) | 0 : 0) {
      c[4836] = 6
      c[4837] = 20
      c[4838] = 2
    }
    if ((c[h >> 2] | 0) != (c[4836] | 0)) {
      i = -1
      return i | 0
    }
    if ((c[(h + 8) >> 2] | 0) != (c[4838] | 0)) {
      i = -1
      return i | 0
    }
    if ((c[(h + 4) >> 2] | 0) != (c[4837] | 0)) {
      i = -1
      return i | 0
    }
    switch (j | 0) {
      case 2: {
        j = c[b >> 2] | 0
        if ((a[18712] | 0) == 0 ? Fi(18712) | 0 : 0) {
          c[4839] = 7
          c[4840] = 8
          c[4841] = 2
        }
        if (
          (
            (c[(j + 12) >> 2] | 0) == (c[4839] | 0)
              ? (c[(j + 20) >> 2] | 0) == (c[4841] | 0)
              : 0
          )
            ? (c[(j + 16) >> 2] | 0) == (c[4840] | 0)
            : 0
        ) {
          i = 1
          return i | 0
        }
        j = c[b >> 2] | 0
        if ((a[18720] | 0) == 0 ? Fi(18720) | 0 : 0) {
          c[4842] = 8
          c[4843] = 6
          c[4844] = 2
        }
        if (
          (
            (c[(j + 12) >> 2] | 0) == (c[4842] | 0)
              ? (c[(j + 20) >> 2] | 0) == (c[4844] | 0)
              : 0
          )
            ? (c[(j + 16) >> 2] | 0) == (c[4843] | 0)
            : 0
        ) {
          i = 2
          return i | 0
        }
        break
      }
      case 3: {
        j = c[b >> 2] | 0
        if ((a[18712] | 0) == 0 ? Fi(18712) | 0 : 0) {
          c[4839] = 7
          c[4840] = 8
          c[4841] = 2
        }
        if (
          (
            (c[(j + 12) >> 2] | 0) == (c[4839] | 0)
              ? (c[(j + 20) >> 2] | 0) == (c[4841] | 0)
              : 0
          )
            ? (c[(j + 16) >> 2] | 0) == (c[4840] | 0)
            : 0
        ) {
          j = c[b >> 2] | 0
          if ((a[18720] | 0) == 0 ? Fi(18720) | 0 : 0) {
            c[4842] = 8
            c[4843] = 6
            c[4844] = 2
          }
          if (
            (
              (c[(j + 24) >> 2] | 0) == (c[4842] | 0)
                ? (c[(j + 32) >> 2] | 0) == (c[4844] | 0)
                : 0
            )
              ? (c[(j + 28) >> 2] | 0) == (c[4843] | 0)
              : 0
          ) {
            i = 3
            return i | 0
          }
        }
        break
      }
      case 1: {
        i = 0
        return i | 0
      }
      default: {
      }
    }
    i = -1
    return i | 0
  }
  function Wc(a) {
    a = a | 0
    Eh(a, 5864)
    c[a >> 2] = 2516
    return
  }
  function Xc(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0
    b = eb
    eb = (eb + 16) | 0
    d = b
    e = (b + 8) | 0
    f = wh(4792) | 0
    g = c[(a + 4) >> 2] | 0
    c[f >> 2] = 2584
    c[(f + 4) >> 2] = g
    ld((f + 8) | 0)
    c[e >> 2] = f
    g = wh(16) | 0
    c[(g + 4) >> 2] = 0
    c[(g + 8) >> 2] = 0
    c[g >> 2] = 2608
    c[(g + 12) >> 2] = f
    h = (e + 4) | 0
    c[h >> 2] = g
    c[d >> 2] = f
    c[(d + 4) >> 2] = f
    xd(e, d)
    d = (a + 12) | 0
    f = c[d >> 2] | 0
    if (f >>> 0 < (c[(a + 16) >> 2] | 0) >>> 0) {
      c[f >> 2] = c[e >> 2]
      c[(f + 4) >> 2] = c[h >> 2]
      c[e >> 2] = 0
      c[h >> 2] = 0
      c[d >> 2] = f + 8
      eb = b
      return
    }
    kd((a + 8) | 0, e)
    e = c[h >> 2] | 0
    if (!e) {
      eb = b
      return
    }
    h = (e + 4) | 0
    a = c[h >> 2] | 0
    c[h >> 2] = a + -1
    if (a | 0) {
      eb = b
      return
    }
    ob[c[((c[e >> 2] | 0) + 8) >> 2] & 255](e)
    th(e)
    eb = b
    return
  }
  function Yc(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    f = (d + 8) | 0
    g = wh(336) | 0
    h = c[(b + 4) >> 2] | 0
    c[g >> 2] = 2636
    c[(g + 4) >> 2] = h
    Fd((g + 8) | 0)
    c[(g + 176) >> 2] = 32
    c[(g + 180) >> 2] = 9
    c[(g + 184) >> 2] = 8
    c[(g + 188) >> 2] = 0
    c[(g + 208) >> 2] = 0
    c[(g + 212) >> 2] = 0
    c[(g + 216) >> 2] = 0
    c[(g + 232) >> 2] = 1
    c[(g + 236) >> 2] = 2
    c[(g + 228) >> 2] = 4096
    c[(g + 224) >> 2] = 4
    c[(g + 220) >> 2] = 4
    c[(g + 240) >> 2] = 0
    c[(g + 244) >> 2] = 0
    c[(g + 248) >> 2] = 0
    c[(g + 192) >> 2] = 32
    c[(g + 196) >> 2] = 0
    c[(g + 200) >> 2] = -2147483648
    c[(g + 204) >> 2] = 2147483647
    c[(g + 172) >> 2] = 0
    c[(g + 256) >> 2] = 32
    c[(g + 260) >> 2] = 9
    c[(g + 264) >> 2] = 8
    c[(g + 268) >> 2] = 0
    c[(g + 288) >> 2] = 0
    c[(g + 292) >> 2] = 0
    c[(g + 296) >> 2] = 0
    c[(g + 312) >> 2] = 1
    c[(g + 316) >> 2] = 2
    c[(g + 308) >> 2] = 4096
    c[(g + 304) >> 2] = 4
    c[(g + 300) >> 2] = 4
    c[(g + 320) >> 2] = 0
    c[(g + 324) >> 2] = 0
    c[(g + 328) >> 2] = 0
    c[(g + 272) >> 2] = 32
    c[(g + 276) >> 2] = 0
    c[(g + 280) >> 2] = -2147483648
    c[(g + 284) >> 2] = 2147483647
    c[(g + 252) >> 2] = 0
    a[(g + 332) >> 0] = 0
    a[(g + 333) >> 0] = 0
    c[f >> 2] = g
    h = wh(16) | 0
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    c[h >> 2] = 2660
    c[(h + 12) >> 2] = g
    i = (f + 4) | 0
    c[i >> 2] = h
    c[e >> 2] = g
    c[(e + 4) >> 2] = g
    xd(f, e)
    e = (b + 12) | 0
    g = c[e >> 2] | 0
    if (g >>> 0 < (c[(b + 16) >> 2] | 0) >>> 0) {
      c[g >> 2] = c[f >> 2]
      c[(g + 4) >> 2] = c[i >> 2]
      c[f >> 2] = 0
      c[i >> 2] = 0
      c[e >> 2] = g + 8
      eb = d
      return
    }
    kd((b + 8) | 0, f)
    f = c[i >> 2] | 0
    if (!f) {
      eb = d
      return
    }
    i = (f + 4) | 0
    b = c[i >> 2] | 0
    c[i >> 2] = b + -1
    if (b | 0) {
      eb = d
      return
    }
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    eb = d
    return
  }
  function Zc(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0
    b = eb
    eb = (eb + 16) | 0
    d = b
    e = (b + 8) | 0
    f = wh(324) | 0
    g = c[(a + 4) >> 2] | 0
    c[f >> 2] = 2688
    c[(f + 4) >> 2] = g
    Md((f + 8) | 0)
    c[e >> 2] = f
    g = wh(16) | 0
    c[(g + 4) >> 2] = 0
    c[(g + 8) >> 2] = 0
    c[g >> 2] = 2712
    c[(g + 12) >> 2] = f
    h = (e + 4) | 0
    c[h >> 2] = g
    c[d >> 2] = f
    c[(d + 4) >> 2] = f
    xd(e, d)
    d = (a + 12) | 0
    f = c[d >> 2] | 0
    if (f >>> 0 < (c[(a + 16) >> 2] | 0) >>> 0) {
      c[f >> 2] = c[e >> 2]
      c[(f + 4) >> 2] = c[h >> 2]
      c[e >> 2] = 0
      c[h >> 2] = 0
      c[d >> 2] = f + 8
      eb = b
      return
    }
    kd((a + 8) | 0, e)
    e = c[h >> 2] | 0
    if (!e) {
      eb = b
      return
    }
    h = (e + 4) | 0
    a = c[h >> 2] | 0
    c[h >> 2] = a + -1
    if (a | 0) {
      eb = b
      return
    }
    ob[c[((c[e >> 2] | 0) + 8) >> 2] & 255](e)
    th(e)
    eb = b
    return
  }
  function _c(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    f = (d + 8) | 0
    g = wh(64) | 0
    h = c[(a + 4) >> 2] | 0
    c[g >> 2] = 2740
    c[(g + 4) >> 2] = h
    Wd((g + 8) | 0, b)
    c[f >> 2] = g
    b = wh(16) | 0
    c[(b + 4) >> 2] = 0
    c[(b + 8) >> 2] = 0
    c[b >> 2] = 2764
    c[(b + 12) >> 2] = g
    h = (f + 4) | 0
    c[h >> 2] = b
    c[e >> 2] = g
    c[(e + 4) >> 2] = g
    xd(f, e)
    e = (a + 12) | 0
    g = c[e >> 2] | 0
    if (g >>> 0 < (c[(a + 16) >> 2] | 0) >>> 0) {
      c[g >> 2] = c[f >> 2]
      c[(g + 4) >> 2] = c[h >> 2]
      c[f >> 2] = 0
      c[h >> 2] = 0
      c[e >> 2] = g + 8
      eb = d
      return
    }
    kd((a + 8) | 0, f)
    f = c[h >> 2] | 0
    if (!f) {
      eb = d
      return
    }
    h = (f + 4) | 0
    a = c[h >> 2] | 0
    c[h >> 2] = a + -1
    if (a | 0) {
      eb = d
      return
    }
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    eb = d
    return
  }
  function $c(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0
    e = eb
    eb = (eb + 48) | 0
    f = e
    c[b >> 2] = d
    a[(b + 4) >> 0] = 0
    g = (b + 8) | 0
    c[g >> 2] = 0
    h = (b + 12) | 0
    c[h >> 2] = 0
    i = (b + 16) | 0
    c[i >> 2] = 0
    j = (d | 0) == 0
    if (!j) {
      if ((d | 0) < 0) Jh(g)
      k = wh(d) | 0
      c[h >> 2] = k
      c[g >> 2] = k
      c[i >> 2] = k + d
      i = d
      g = k
      do {
        a[g >> 0] = 0
        g = ((c[h >> 2] | 0) + 1) | 0
        c[h >> 2] = g
        i = (i + -1) | 0
      } while ((i | 0) != 0)
    }
    i = (b + 20) | 0
    c[i >> 2] = 0
    g = (b + 24) | 0
    c[g >> 2] = 0
    h = (b + 28) | 0
    c[h >> 2] = 0
    if (!j) {
      if ((d | 0) < 0) Jh(i)
      k = wh(d) | 0
      c[g >> 2] = k
      c[i >> 2] = k
      c[h >> 2] = k + d
      h = d
      i = k
      do {
        a[i >> 0] = 0
        i = ((c[g >> 2] | 0) + 1) | 0
        c[g >> 2] = i
        h = (h + -1) | 0
      } while ((h | 0) != 0)
    }
    Fc(f, 256, 0, 0)
    h = (b + 32) | 0
    c[h >> 2] = 0
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    c[(h + 12) >> 2] = 0
    c[(h + 16) >> 2] = 0
    c[(h + 20) >> 2] = 0
    if (!j) {
      j = (b + 52) | 0
      ae(h, d)
      h = c[(b + 36) >> 2] | 0
      i = ((c[(b + 48) >> 2] | 0) + (c[j >> 2] | 0)) | 0
      g = ((i >>> 0) / 93) | 0
      k = (h + (g << 2)) | 0
      if ((c[(b + 40) >> 2] | 0) == (h | 0)) l = 0
      else l = ((c[k >> 2] | 0) + ((((i - ((g * 93) | 0)) | 0) * 44) | 0)) | 0
      g = d
      d = k
      k = l
      while (1) {
        l = k
        Hc(l, f)
        g = (g + -1) | 0
        i = (l + 44) | 0
        if (((i - (c[d >> 2] | 0)) | 0) == 4092) {
          l = (d + 4) | 0
          m = l
          n = c[l >> 2] | 0
        } else {
          m = d
          n = i
        }
        c[j >> 2] = (c[j >> 2] | 0) + 1
        if (!g) break
        else {
          d = m
          k = n
        }
      }
    }
    n = c[(f + 8) >> 2] | 0
    if (n | 0) gh(c[(n + -4) >> 2] | 0)
    n = c[(f + 12) >> 2] | 0
    if (n | 0) gh(c[(n + -4) >> 2] | 0)
    n = c[(f + 16) >> 2] | 0
    if (!n) {
      eb = e
      return
    }
    gh(c[(n + -4) >> 2] | 0)
    eb = e
    return
  }
  function ad(b) {
    b = b | 0
    ld(b)
    Fd((b + 4784) | 0)
    c[(b + 4952) >> 2] = 32
    c[(b + 4956) >> 2] = 9
    c[(b + 4960) >> 2] = 8
    c[(b + 4964) >> 2] = 0
    c[(b + 4984) >> 2] = 0
    c[(b + 4988) >> 2] = 0
    c[(b + 4992) >> 2] = 0
    c[(b + 5008) >> 2] = 1
    c[(b + 5012) >> 2] = 2
    c[(b + 5004) >> 2] = 4096
    c[(b + 5e3) >> 2] = 4
    c[(b + 4996) >> 2] = 4
    c[(b + 5016) >> 2] = 0
    c[(b + 5020) >> 2] = 0
    c[(b + 5024) >> 2] = 0
    c[(b + 4968) >> 2] = 32
    c[(b + 4972) >> 2] = 0
    c[(b + 4976) >> 2] = -2147483648
    c[(b + 4980) >> 2] = 2147483647
    c[(b + 4948) >> 2] = 0
    c[(b + 5032) >> 2] = 32
    c[(b + 5036) >> 2] = 9
    c[(b + 5040) >> 2] = 8
    c[(b + 5044) >> 2] = 0
    c[(b + 5064) >> 2] = 0
    c[(b + 5068) >> 2] = 0
    c[(b + 5072) >> 2] = 0
    c[(b + 5088) >> 2] = 1
    c[(b + 5092) >> 2] = 2
    c[(b + 5084) >> 2] = 4096
    c[(b + 5080) >> 2] = 4
    c[(b + 5076) >> 2] = 4
    c[(b + 5096) >> 2] = 0
    c[(b + 5100) >> 2] = 0
    c[(b + 5104) >> 2] = 0
    c[(b + 5048) >> 2] = 32
    c[(b + 5052) >> 2] = 0
    c[(b + 5056) >> 2] = -2147483648
    c[(b + 5060) >> 2] = 2147483647
    c[(b + 5028) >> 2] = 0
    a[(b + 5108) >> 0] = 0
    a[(b + 5109) >> 0] = 0
    Md((b + 5112) | 0)
    a[(b + 5428) >> 0] = 1
    return
  }
  function bd(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function cd(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0
    e = c[(b + 8) >> 2] | 0
    f = c[(b + 12) >> 2] | 0
    if ((e | 0) == (f | 0)) g = d
    else {
      h = d
      d = e
      while (1) {
        e = c[d >> 2] | 0
        i = c[(d + 4) >> 2] | 0
        j = (i | 0) == 0
        if (!j) {
          k = (i + 4) | 0
          c[k >> 2] = (c[k >> 2] | 0) + 1
        }
        k = kb[c[((c[e >> 2] | 0) + 12) >> 2] & 63](e, h) | 0
        if (
          !j
            ? ((j = (i + 4) | 0),
              (e = c[j >> 2] | 0),
              (c[j >> 2] = e + -1),
              (e | 0) == 0)
            : 0
        ) {
          ob[c[((c[i >> 2] | 0) + 8) >> 2] & 255](i)
          th(i)
        }
        d = (d + 8) | 0
        if ((d | 0) == (f | 0)) {
          g = k
          break
        } else h = k
      }
    }
    h = (b + 20) | 0
    if (!(a[h >> 0] | 0)) return g | 0
    a[h >> 0] = 0
    wc(c[(b + 4) >> 2] | 0)
    return g | 0
  }
  function dd(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    c[a >> 2] = 2536
    b = (a + 8) | 0
    d = c[b >> 2] | 0
    if (!d) return
    e = (a + 12) | 0
    a = c[e >> 2] | 0
    if ((a | 0) == (d | 0)) f = d
    else {
      g = a
      do {
        a = c[(g + -4) >> 2] | 0
        g = (g + -8) | 0
        if (
          a | 0
            ? ((h = (a + 4) | 0),
              (i = c[h >> 2] | 0),
              (c[h >> 2] = i + -1),
              (i | 0) == 0)
            : 0
        ) {
          ob[c[((c[a >> 2] | 0) + 8) >> 2] & 255](a)
          th(a)
        }
      } while ((g | 0) != (d | 0))
      f = c[b >> 2] | 0
    }
    c[e >> 2] = d
    yh(f)
    return
  }
  function ed(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    c[a >> 2] = 2536
    b = (a + 8) | 0
    d = c[b >> 2] | 0
    if (!d) {
      yh(a)
      return
    }
    e = (a + 12) | 0
    f = c[e >> 2] | 0
    if ((f | 0) == (d | 0)) g = d
    else {
      h = f
      do {
        f = c[(h + -4) >> 2] | 0
        h = (h + -8) | 0
        if (
          f | 0
            ? ((i = (f + 4) | 0),
              (j = c[i >> 2] | 0),
              (c[i >> 2] = j + -1),
              (j | 0) == 0)
            : 0
        ) {
          ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
          th(f)
        }
      } while ((h | 0) != (d | 0))
      g = c[b >> 2] | 0
    }
    c[e >> 2] = d
    yh(g)
    yh(a)
    return
  }
  function fd(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function gd(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function hd(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
    return
  }
  function id(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 6279 ? (a + 12) | 0 : 0) | 0
  }
  function jd(a) {
    a = a | 0
    yh(a)
    return
  }
  function kd(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0
    d = (a + 4) | 0
    e = c[d >> 2] | 0
    f = c[a >> 2] | 0
    g = (e - f) >> 3
    h = (g + 1) | 0
    i = f
    j = e
    if (h >>> 0 > 536870911) Jh(a)
    e = (a + 8) | 0
    k = ((c[e >> 2] | 0) - f) | 0
    l = k >> 2
    m = (k >> 3) >>> 0 < 268435455 ? (l >>> 0 < h >>> 0 ? h : l) : 536870911
    do
      if (m)
        if (m >>> 0 > 536870911) {
          l = I(8) | 0
          Ch(l, 4471)
          c[l >> 2] = 3844
          K(l | 0, 2008, 119)
        } else {
          n = wh(m << 3) | 0
          break
        }
      else n = 0
    while (0)
    l = (n + (g << 3)) | 0
    h = (n + (m << 3)) | 0
    c[l >> 2] = c[b >> 2]
    m = (b + 4) | 0
    c[(n + (g << 3) + 4) >> 2] = c[m >> 2]
    c[b >> 2] = 0
    c[m >> 2] = 0
    m = (l + 8) | 0
    if ((j | 0) == (i | 0)) {
      o = l
      p = i
      q = f
    } else {
      b = (g + -1 - (((j + -8 + (0 - f)) | 0) >>> 3)) | 0
      f = j
      j = l
      do {
        l = j
        j = (j + -8) | 0
        g = f
        f = (f + -8) | 0
        c[j >> 2] = c[f >> 2]
        k = (g + -4) | 0
        c[(l + -4) >> 2] = c[k >> 2]
        c[f >> 2] = 0
        c[k >> 2] = 0
      } while ((f | 0) != (i | 0))
      i = c[a >> 2] | 0
      o = (n + (b << 3)) | 0
      p = i
      q = i
    }
    c[a >> 2] = o
    o = c[d >> 2] | 0
    c[d >> 2] = m
    c[e >> 2] = h
    if ((o | 0) != (p | 0)) {
      h = o
      do {
        o = c[(h + -4) >> 2] | 0
        h = (h + -8) | 0
        if (
          o | 0
            ? ((e = (o + 4) | 0),
              (m = c[e >> 2] | 0),
              (c[e >> 2] = m + -1),
              (m | 0) == 0)
            : 0
        ) {
          ob[c[((c[o >> 2] | 0) + 8) >> 2] & 255](o)
          th(o)
        }
      } while ((h | 0) != (p | 0))
    }
    if (!q) return
    yh(q)
    return
  }
  function ld(b) {
    b = b | 0
    qd(b)
    rd((b + 3980) | 0)
    sd((b + 4380) | 0)
    a[(b + 4780) >> 0] = 0
    a[(b + 4781) >> 0] = 0
    return
  }
  function md(a) {
    a = a | 0
    c[a >> 2] = 2584
    yc((a + 4708) | 0)
    yc((a + 4628) | 0)
    yc((a + 4548) | 0)
    yc((a + 4468) | 0)
    yc((a + 4388) | 0)
    ud((a + 4308) | 0)
    ud((a + 4228) | 0)
    ud((a + 4148) | 0)
    ud((a + 4068) | 0)
    ud((a + 3988) | 0)
    td((a + 8) | 0)
    return
  }
  function nd(a) {
    a = a | 0
    c[a >> 2] = 2584
    yc((a + 4708) | 0)
    yc((a + 4628) | 0)
    yc((a + 4548) | 0)
    yc((a + 4468) | 0)
    yc((a + 4388) | 0)
    ud((a + 4308) | 0)
    ud((a + 4228) | 0)
    ud((a + 4148) | 0)
    ud((a + 4068) | 0)
    ud((a + 3988) | 0)
    td((a + 8) | 0)
    yh(a)
    return
  }
  function od(a, b) {
    a = a | 0
    b = b | 0
    return b | 0
  }
  function pd(a, b) {
    a = a | 0
    b = b | 0
    return vd((a + 8) | 0, c[(a + 4) >> 2] | 0, b) | 0
  }
  function qd(d) {
    d = d | 0
    var e = 0,
      f = 0
    a[d >> 0] = 0
    a[(d + 1) >> 0] = 0
    a[(d + 2) >> 0] = 0
    a[(d + 3) >> 0] = 0
    e = (d + 4) | 0
    a[e >> 0] = 0
    a[(e + 1) >> 0] = 0
    a[(e + 2) >> 0] = 0
    a[(e + 3) >> 0] = 0
    e = (d + 12) | 0
    f = e
    a[f >> 0] = 0
    a[(f + 1) >> 0] = 0
    a[(f + 2) >> 0] = 0
    a[(f + 3) >> 0] = 0
    f = (e + 4) | 0
    a[f >> 0] = 0
    a[(f + 1) >> 0] = 0
    a[(f + 2) >> 0] = 0
    a[(f + 3) >> 0] = 0
    f = (d + 52) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 72) >> 0] = 1
    f = (d + 76) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 96) >> 0] = 1
    f = (d + 100) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 120) >> 0] = 1
    f = (d + 124) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 144) >> 0] = 1
    f = (d + 148) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 168) >> 0] = 1
    f = (d + 172) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 192) >> 0] = 1
    f = (d + 196) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 216) >> 0] = 1
    f = (d + 220) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 240) >> 0] = 1
    f = (d + 244) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 264) >> 0] = 1
    f = (d + 268) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 288) >> 0] = 1
    f = (d + 292) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 312) >> 0] = 1
    f = (d + 316) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 336) >> 0] = 1
    f = (d + 340) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 360) >> 0] = 1
    f = (d + 364) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 384) >> 0] = 1
    f = (d + 388) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 408) >> 0] = 1
    f = (d + 412) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 432) >> 0] = 1
    f = (d + 436) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 456) >> 0] = 1
    f = (d + 460) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 480) >> 0] = 1
    f = (d + 484) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 504) >> 0] = 1
    f = (d + 508) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 528) >> 0] = 1
    f = (d + 532) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 552) >> 0] = 1
    f = (d + 556) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 576) >> 0] = 1
    f = (d + 580) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 600) >> 0] = 1
    f = (d + 604) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 624) >> 0] = 1
    f = (d + 628) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 648) >> 0] = 1
    f = (d + 652) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 672) >> 0] = 1
    f = (d + 676) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 696) >> 0] = 1
    f = (d + 700) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 720) >> 0] = 1
    f = (d + 724) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 744) >> 0] = 1
    f = (d + 748) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 768) >> 0] = 1
    f = (d + 772) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 792) >> 0] = 1
    f = (d + 796) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    a[(d + 816) >> 0] = 1
    Fc((d + 852) | 0, 64, 0, 0)
    a[(d + 3976) >> 0] = 0
    f = (d + 20) | 0
    e = (f + 32) | 0
    do {
      b[f >> 1] = 0
      f = (f + 2) | 0
    } while ((f | 0) < (e | 0))
    f = wh(44) | 0
    Fc(f, 256, 0, 0)
    c[(d + 896) >> 2] = f
    f = wh(44) | 0
    Fc(f, 256, 0, 0)
    c[(d + 900) >> 2] = f
    f = (d + 820) | 0
    c[f >> 2] = 0
    c[(f + 4) >> 2] = 0
    c[(f + 8) >> 2] = 0
    c[(f + 12) >> 2] = 0
    c[(f + 16) >> 2] = 0
    c[(f + 20) >> 2] = 0
    c[(f + 24) >> 2] = 0
    c[(f + 28) >> 2] = 0
    f = 0
    do {
      e = wh(44) | 0
      Fc(e, 256, 0, 0)
      c[(d + 904 + (f << 2)) >> 2] = e
      e = wh(44) | 0
      Fc(e, 256, 0, 0)
      c[(d + 1928 + (f << 2)) >> 2] = e
      e = wh(44) | 0
      Fc(e, 256, 0, 0)
      c[(d + 2952 + (f << 2)) >> 2] = e
      f = (f + 1) | 0
    } while (f >>> 0 < 256)
    return
  }
  function rd(a) {
    a = a | 0
    c[(a + 4) >> 2] = 16
    c[(a + 8) >> 2] = 4
    c[(a + 12) >> 2] = 8
    c[(a + 16) >> 2] = 0
    c[(a + 36) >> 2] = 0
    c[(a + 40) >> 2] = 0
    c[(a + 44) >> 2] = 0
    c[(a + 60) >> 2] = 1
    c[(a + 64) >> 2] = 2
    c[(a + 56) >> 2] = 4096
    c[(a + 52) >> 2] = 4
    c[(a + 48) >> 2] = 4
    c[(a + 68) >> 2] = 0
    c[(a + 72) >> 2] = 0
    c[(a + 76) >> 2] = 0
    c[(a + 20) >> 2] = 16
    c[(a + 24) >> 2] = 65536
    c[(a + 28) >> 2] = -32768
    c[(a + 32) >> 2] = 32767
    c[a >> 2] = 0
    c[(a + 84) >> 2] = 16
    c[(a + 88) >> 2] = 1
    c[(a + 92) >> 2] = 8
    c[(a + 96) >> 2] = 0
    c[(a + 116) >> 2] = 0
    c[(a + 120) >> 2] = 0
    c[(a + 124) >> 2] = 0
    c[(a + 140) >> 2] = 1
    c[(a + 144) >> 2] = 2
    c[(a + 136) >> 2] = 4096
    c[(a + 132) >> 2] = 4
    c[(a + 128) >> 2] = 4
    c[(a + 148) >> 2] = 0
    c[(a + 152) >> 2] = 0
    c[(a + 156) >> 2] = 0
    c[(a + 100) >> 2] = 16
    c[(a + 104) >> 2] = 65536
    c[(a + 108) >> 2] = -32768
    c[(a + 112) >> 2] = 32767
    c[(a + 80) >> 2] = 0
    c[(a + 164) >> 2] = 32
    c[(a + 168) >> 2] = 2
    c[(a + 172) >> 2] = 8
    c[(a + 176) >> 2] = 0
    c[(a + 196) >> 2] = 0
    c[(a + 200) >> 2] = 0
    c[(a + 204) >> 2] = 0
    c[(a + 220) >> 2] = 1
    c[(a + 224) >> 2] = 2
    c[(a + 216) >> 2] = 4096
    c[(a + 212) >> 2] = 4
    c[(a + 208) >> 2] = 4
    c[(a + 228) >> 2] = 0
    c[(a + 232) >> 2] = 0
    c[(a + 236) >> 2] = 0
    c[(a + 180) >> 2] = 32
    c[(a + 184) >> 2] = 0
    c[(a + 188) >> 2] = -2147483648
    c[(a + 192) >> 2] = 2147483647
    c[(a + 160) >> 2] = 0
    c[(a + 244) >> 2] = 32
    c[(a + 248) >> 2] = 22
    c[(a + 252) >> 2] = 8
    c[(a + 256) >> 2] = 0
    c[(a + 276) >> 2] = 0
    c[(a + 280) >> 2] = 0
    c[(a + 284) >> 2] = 0
    c[(a + 300) >> 2] = 1
    c[(a + 304) >> 2] = 2
    c[(a + 296) >> 2] = 4096
    c[(a + 292) >> 2] = 4
    c[(a + 288) >> 2] = 4
    c[(a + 308) >> 2] = 0
    c[(a + 312) >> 2] = 0
    c[(a + 316) >> 2] = 0
    c[(a + 260) >> 2] = 32
    c[(a + 264) >> 2] = 0
    c[(a + 268) >> 2] = -2147483648
    c[(a + 272) >> 2] = 2147483647
    c[(a + 240) >> 2] = 0
    c[(a + 324) >> 2] = 32
    c[(a + 328) >> 2] = 20
    c[(a + 332) >> 2] = 8
    c[(a + 336) >> 2] = 0
    c[(a + 356) >> 2] = 0
    c[(a + 360) >> 2] = 0
    c[(a + 364) >> 2] = 0
    c[(a + 380) >> 2] = 1
    c[(a + 384) >> 2] = 2
    c[(a + 376) >> 2] = 4096
    c[(a + 372) >> 2] = 4
    c[(a + 368) >> 2] = 4
    c[(a + 388) >> 2] = 0
    c[(a + 392) >> 2] = 0
    c[(a + 396) >> 2] = 0
    c[(a + 340) >> 2] = 32
    c[(a + 344) >> 2] = 0
    c[(a + 348) >> 2] = -2147483648
    c[(a + 352) >> 2] = 2147483647
    c[(a + 320) >> 2] = 0
    return
  }
  function sd(a) {
    a = a | 0
    c[(a + 4) >> 2] = 16
    c[(a + 8) >> 2] = 4
    c[(a + 12) >> 2] = 8
    c[(a + 16) >> 2] = 0
    c[(a + 36) >> 2] = 0
    c[(a + 40) >> 2] = 0
    c[(a + 44) >> 2] = 0
    c[(a + 60) >> 2] = 1
    c[(a + 64) >> 2] = 2
    c[(a + 56) >> 2] = 4096
    c[(a + 52) >> 2] = 4
    c[(a + 48) >> 2] = 4
    c[(a + 68) >> 2] = 0
    c[(a + 72) >> 2] = 0
    c[(a + 76) >> 2] = 0
    c[(a + 20) >> 2] = 16
    c[(a + 24) >> 2] = 65536
    c[(a + 28) >> 2] = -32768
    c[(a + 32) >> 2] = 32767
    c[a >> 2] = 0
    c[(a + 84) >> 2] = 16
    c[(a + 88) >> 2] = 1
    c[(a + 92) >> 2] = 8
    c[(a + 96) >> 2] = 0
    c[(a + 116) >> 2] = 0
    c[(a + 120) >> 2] = 0
    c[(a + 124) >> 2] = 0
    c[(a + 140) >> 2] = 1
    c[(a + 144) >> 2] = 2
    c[(a + 136) >> 2] = 4096
    c[(a + 132) >> 2] = 4
    c[(a + 128) >> 2] = 4
    c[(a + 148) >> 2] = 0
    c[(a + 152) >> 2] = 0
    c[(a + 156) >> 2] = 0
    c[(a + 100) >> 2] = 16
    c[(a + 104) >> 2] = 65536
    c[(a + 108) >> 2] = -32768
    c[(a + 112) >> 2] = 32767
    c[(a + 80) >> 2] = 0
    c[(a + 164) >> 2] = 32
    c[(a + 168) >> 2] = 2
    c[(a + 172) >> 2] = 8
    c[(a + 176) >> 2] = 0
    c[(a + 196) >> 2] = 0
    c[(a + 200) >> 2] = 0
    c[(a + 204) >> 2] = 0
    c[(a + 220) >> 2] = 1
    c[(a + 224) >> 2] = 2
    c[(a + 216) >> 2] = 4096
    c[(a + 212) >> 2] = 4
    c[(a + 208) >> 2] = 4
    c[(a + 228) >> 2] = 0
    c[(a + 232) >> 2] = 0
    c[(a + 236) >> 2] = 0
    c[(a + 180) >> 2] = 32
    c[(a + 184) >> 2] = 0
    c[(a + 188) >> 2] = -2147483648
    c[(a + 192) >> 2] = 2147483647
    c[(a + 160) >> 2] = 0
    c[(a + 244) >> 2] = 32
    c[(a + 248) >> 2] = 22
    c[(a + 252) >> 2] = 8
    c[(a + 256) >> 2] = 0
    c[(a + 276) >> 2] = 0
    c[(a + 280) >> 2] = 0
    c[(a + 284) >> 2] = 0
    c[(a + 300) >> 2] = 1
    c[(a + 304) >> 2] = 2
    c[(a + 296) >> 2] = 4096
    c[(a + 292) >> 2] = 4
    c[(a + 288) >> 2] = 4
    c[(a + 308) >> 2] = 0
    c[(a + 312) >> 2] = 0
    c[(a + 316) >> 2] = 0
    c[(a + 260) >> 2] = 32
    c[(a + 264) >> 2] = 0
    c[(a + 268) >> 2] = -2147483648
    c[(a + 272) >> 2] = 2147483647
    c[(a + 240) >> 2] = 0
    c[(a + 324) >> 2] = 32
    c[(a + 328) >> 2] = 20
    c[(a + 332) >> 2] = 8
    c[(a + 336) >> 2] = 0
    c[(a + 356) >> 2] = 0
    c[(a + 360) >> 2] = 0
    c[(a + 364) >> 2] = 0
    c[(a + 380) >> 2] = 1
    c[(a + 384) >> 2] = 2
    c[(a + 376) >> 2] = 4096
    c[(a + 372) >> 2] = 4
    c[(a + 368) >> 2] = 4
    c[(a + 388) >> 2] = 0
    c[(a + 392) >> 2] = 0
    c[(a + 396) >> 2] = 0
    c[(a + 340) >> 2] = 32
    c[(a + 344) >> 2] = 0
    c[(a + 348) >> 2] = -2147483648
    c[(a + 352) >> 2] = 2147483647
    c[(a + 320) >> 2] = 0
    return
  }
  function td(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0
    b = c[(a + 896) >> 2] | 0
    if (b | 0) {
      d = c[(b + 8) >> 2] | 0
      if (d | 0) gh(c[(d + -4) >> 2] | 0)
      d = c[(b + 12) >> 2] | 0
      if (d | 0) gh(c[(d + -4) >> 2] | 0)
      d = c[(b + 16) >> 2] | 0
      if (d | 0) gh(c[(d + -4) >> 2] | 0)
      yh(b)
    }
    b = c[(a + 900) >> 2] | 0
    if (b | 0) {
      d = c[(b + 8) >> 2] | 0
      if (d | 0) gh(c[(d + -4) >> 2] | 0)
      d = c[(b + 12) >> 2] | 0
      if (d | 0) gh(c[(d + -4) >> 2] | 0)
      d = c[(b + 16) >> 2] | 0
      if (d | 0) gh(c[(d + -4) >> 2] | 0)
      yh(b)
    }
    b = 0
    do {
      d = c[(a + 904 + (b << 2)) >> 2] | 0
      if (d | 0) {
        e = c[(d + 8) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        e = c[(d + 12) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        e = c[(d + 16) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        yh(d)
      }
      d = c[(a + 1928 + (b << 2)) >> 2] | 0
      if (d | 0) {
        e = c[(d + 8) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        e = c[(d + 12) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        e = c[(d + 16) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        yh(d)
      }
      d = c[(a + 2952 + (b << 2)) >> 2] | 0
      if (d | 0) {
        e = c[(d + 8) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        e = c[(d + 12) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        e = c[(d + 16) >> 2] | 0
        if (e | 0) gh(c[(e + -4) >> 2] | 0)
        yh(d)
      }
      b = (b + 1) | 0
    } while ((b | 0) != 256)
    b = c[(a + 860) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 864) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 868) >> 2] | 0
    if (!b) return
    gh(c[(b + -4) >> 2] | 0)
    return
  }
  function ud(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0
    b = (a + 36) | 0
    d = c[b >> 2] | 0
    e = (a + 40) | 0
    f = c[e >> 2] | 0
    if ((f | 0) != (d | 0)) {
      g = f
      do {
        f = c[(g + -36) >> 2] | 0
        if (f | 0) gh(c[(f + -4) >> 2] | 0)
        f = c[(g + -32) >> 2] | 0
        if (f | 0) gh(c[(f + -4) >> 2] | 0)
        f = c[(g + -28) >> 2] | 0
        g = (g + -44) | 0
        if (f | 0) gh(c[(f + -4) >> 2] | 0)
      } while ((g | 0) != (d | 0))
    }
    c[e >> 2] = d
    d = (a + 68) | 0
    g = c[d >> 2] | 0
    f = (a + 72) | 0
    a = c[f >> 2] | 0
    if ((a | 0) == (g | 0)) h = g
    else {
      i = a
      do {
        a = c[(i + -36) >> 2] | 0
        if (a | 0) gh(c[(a + -4) >> 2] | 0)
        a = c[(i + -32) >> 2] | 0
        if (a | 0) gh(c[(a + -4) >> 2] | 0)
        a = c[(i + -28) >> 2] | 0
        i = (i + -44) | 0
        if (a | 0) gh(c[(a + -4) >> 2] | 0)
      } while ((i | 0) != (g | 0))
      h = c[d >> 2] | 0
    }
    c[f >> 2] = g
    if (h | 0) {
      if ((g | 0) == (h | 0)) j = h
      else {
        i = g
        do {
          g = c[(i + -36) >> 2] | 0
          if (g | 0) gh(c[(g + -4) >> 2] | 0)
          g = c[(i + -32) >> 2] | 0
          if (g | 0) gh(c[(g + -4) >> 2] | 0)
          g = c[(i + -28) >> 2] | 0
          i = (i + -44) | 0
          if (g | 0) gh(c[(g + -4) >> 2] | 0)
        } while ((i | 0) != (h | 0))
        j = c[d >> 2] | 0
      }
      c[f >> 2] = h
      yh(j)
    }
    j = c[b >> 2] | 0
    if (!j) return
    h = c[e >> 2] | 0
    if ((h | 0) == (j | 0)) k = j
    else {
      f = h
      do {
        h = c[(f + -36) >> 2] | 0
        if (h | 0) gh(c[(h + -4) >> 2] | 0)
        h = c[(f + -32) >> 2] | 0
        if (h | 0) gh(c[(h + -4) >> 2] | 0)
        h = c[(f + -28) >> 2] | 0
        f = (f + -44) | 0
        if (h | 0) gh(c[(h + -4) >> 2] | 0)
      } while ((f | 0) != (j | 0))
      k = c[b >> 2] | 0
    }
    c[e >> 2] = j
    yh(k)
    return
  }
  function vd(f, g, h) {
    f = f | 0
    g = g | 0
    h = h | 0
    var i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0
    i = (f + 4781) | 0
    if (!(a[i >> 0] | 0)) {
      xc((f + 4380) | 0)
      xc((f + 4460) | 0)
      xc((f + 4540) | 0)
      xc((f + 4620) | 0)
      xc((f + 4700) | 0)
      a[i >> 0] = 1
    }
    i = (f + 3976) | 0
    if (!(a[i >> 0] | 0)) {
      a[i >> 0] = 1
      wd(c[g >> 2] | 0, h, 20)
      i =
        (d[(h + 1) >> 0] << 8) |
        d[h >> 0] |
        (d[(h + 2) >> 0] << 16) |
        (d[(h + 3) >> 0] << 24)
      j =
        (d[(h + 5) >> 0] << 8) |
        d[(h + 4) >> 0] |
        (d[(h + 6) >> 0] << 16) |
        (d[(h + 7) >> 0] << 24)
      k =
        (d[(h + 9) >> 0] << 8) |
        d[(h + 8) >> 0] |
        (d[(h + 10) >> 0] << 16) |
        (d[(h + 11) >> 0] << 24)
      l = ((a[(h + 13) >> 0] << 8) | d[(h + 12) >> 0]) & 65535
      m = a[(h + 14) >> 0] | 0
      n = a[(h + 15) >> 0] | 0
      o = a[(h + 16) >> 0] | 0
      p = a[(h + 17) >> 0] | 0
      q = ((a[(h + 19) >> 0] << 8) | d[(h + 18) >> 0]) & 65535
      a[f >> 0] = i
      a[(f + 1) >> 0] = i >> 8
      a[(f + 2) >> 0] = i >> 16
      a[(f + 3) >> 0] = i >> 24
      i = (f + 4) | 0
      a[i >> 0] = j
      a[(i + 1) >> 0] = j >> 8
      a[(i + 2) >> 0] = j >> 16
      a[(i + 3) >> 0] = j >> 24
      j = (f + 8) | 0
      a[j >> 0] = k
      a[(j + 1) >> 0] = k >> 8
      a[(j + 2) >> 0] = k >> 16
      a[(j + 3) >> 0] = k >> 24
      k = (f + 12) | 0
      a[k >> 0] = l
      a[(k + 1) >> 0] = l >> 8
      a[(f + 14) >> 0] = m
      a[(f + 15) >> 0] = n
      a[(f + 16) >> 0] = o
      a[(f + 17) >> 0] = p
      p = (f + 18) | 0
      a[p >> 0] = q
      a[(p + 1) >> 0] = q >> 8
      r = (h + 20) | 0
      return r | 0
    }
    q = Kc(g, (f + 852) | 0) | 0
    if (q) {
      p = (f + 14) | 0
      if (!(q & 32)) s = a[p >> 0] | 0
      else {
        o = (Kc(g, c[(f + 904 + (d[p >> 0] << 2)) >> 2] | 0) | 0) & 255
        a[p >> 0] = o
        s = o
      }
      o = s & 7
      n = ((s & 255) >>> 3) & 7
      s = d[(16 + (n << 3) + o) >> 0] | 0
      m = d[(80 + (n << 3) + o) >> 0] | 0
      if (!(q & 16)) b[(f + 12) >> 1] = b[(f + 20 + (s << 1)) >> 1] | 0
      else {
        o = (f + 20 + (s << 1)) | 0
        l = e[o >> 1] | 0
        k =
          ((Jc(
            (f + 4380) | 0,
            g,
            ((c[(f + 4416) >> 2] | 0) + (((s >>> 0 < 3 ? s : 3) * 44) | 0)) | 0
          ) |
            0) +
            l) |
          0
        l = c[(f + 4404) >> 2] | 0
        if ((k | 0) < 0) t = (k + l) | 0
        else t = (k - (k >>> 0 < l >>> 0 ? 0 : l)) | 0
        l = t & 65535
        b[(f + 12) >> 1] = l
        b[o >> 1] = l
      }
      if ((q & 8) | 0) {
        l = (f + 15) | 0
        a[l >> 0] = Kc(g, c[(f + 1928 + (d[l >> 0] << 2)) >> 2] | 0) | 0
      }
      if ((q & 4) | 0) {
        l =
          Kc(g, c[(f + 896 + ((((d[p >> 0] | 0) >>> 6) & 1) << 2)) >> 2] | 0) |
          0
        p = (f + 16) | 0
        a[p >> 0] = l + (d[p >> 0] | 0)
      }
      if ((q & 2) | 0) {
        p = (f + 17) | 0
        a[p >> 0] = Kc(g, c[(f + 2952 + (d[p >> 0] << 2)) >> 2] | 0) | 0
      }
      if (!(q & 1)) {
        u = n
        v = s
        w = m
      } else {
        q = (f + 18) | 0
        p = e[q >> 1] | 0
        l = ((Jc((f + 4460) | 0, g, c[(f + 4496) >> 2] | 0) | 0) + p) | 0
        p = c[(f + 4484) >> 2] | 0
        if ((l | 0) < 0) x = (l + p) | 0
        else x = (l - (l >>> 0 < p >>> 0 ? 0 : p)) | 0
        b[q >> 1] = x
        u = n
        v = s
        w = m
      }
    } else {
      m = a[(f + 14) >> 0] | 0
      s = m & 7
      n = ((m & 255) >>> 3) & 7
      u = n
      v = d[(16 + (n << 3) + s) >> 0] | 0
      w = d[(80 + (n << 3) + s) >> 0] | 0
    }
    s = (f + 52 + ((v * 24) | 0)) | 0
    n = (f + 52 + ((v * 24) | 0) + 8) | 0
    m = c[n >> 2] | 0
    x = (f + 4540) | 0
    q = ((u | 0) == 1) & 1
    u =
      ((Jc(x, g, ((c[(f + 4576) >> 2] | 0) + ((q * 44) | 0)) | 0) | 0) + m) | 0
    m = c[(f + 4564) >> 2] | 0
    if ((u | 0) < 0) y = (u + m) | 0
    else y = (u - (u >>> 0 < m >>> 0 ? 0 : m)) | 0
    c[f >> 2] = (c[f >> 2] | 0) + y
    m = (f + 52 + ((v * 24) | 0) + 20) | 0
    u = c[n >> 2] | 0
    do
      if (!(a[m >> 0] | 0)) {
        p = (f + 52 + ((v * 24) | 0) + 4) | 0
        l = c[p >> 2] | 0
        if ((u | 0) >= (y | 0)) {
          if ((l | 0) < (y | 0)) {
            c[s >> 2] = l
            z = p
          } else z = s
          c[z >> 2] = y
          a[m >> 0] = 1
          break
        }
        c[s >> 2] = l
        c[p >> 2] = u
        p = (f + 52 + ((v * 24) | 0) + 16) | 0
        l = c[p >> 2] | 0
        o = (f + 52 + ((v * 24) | 0) + 12) | 0
        t = c[o >> 2] | 0
        if ((l | 0) < (y | 0)) {
          c[n >> 2] = t
          c[o >> 2] = l
          c[p >> 2] = y
          break
        }
        if ((t | 0) < (y | 0)) {
          c[n >> 2] = t
          c[o >> 2] = y
          break
        } else {
          c[n >> 2] = y
          break
        }
      } else {
        o = (f + 52 + ((v * 24) | 0) + 12) | 0
        t = c[o >> 2] | 0
        if ((y | 0) >= (u | 0)) {
          p = (f + 52 + ((v * 24) | 0) + 16) | 0
          if ((y | 0) < (t | 0)) {
            c[p >> 2] = t
            A = o
          } else A = p
          c[A >> 2] = y
          a[m >> 0] = 0
          break
        }
        c[(f + 52 + ((v * 24) | 0) + 16) >> 2] = t
        c[o >> 2] = u
        o = c[s >> 2] | 0
        t = (f + 52 + ((v * 24) | 0) + 4) | 0
        p = c[t >> 2] | 0
        if ((y | 0) < (o | 0)) {
          c[n >> 2] = p
          c[t >> 2] = o
          c[s >> 2] = y
          break
        }
        if ((y | 0) < (p | 0)) {
          c[n >> 2] = p
          c[t >> 2] = y
          break
        } else {
          c[n >> 2] = y
          break
        }
      }
    while (0)
    y = (f + 436 + ((v * 24) | 0)) | 0
    n = (f + 436 + ((v * 24) | 0) + 8) | 0
    s = c[n >> 2] | 0
    u = c[x >> 2] | 0
    m = (f + 4620) | 0
    A =
      ((Jc(
        m,
        g,
        ((c[(f + 4656) >> 2] | 0) +
          ((((u >>> 0 < 20 ? u & -2 : 20) | q) * 44) | 0)) |
          0
      ) |
        0) +
        s) |
      0
    s = c[(f + 4644) >> 2] | 0
    if ((A | 0) < 0) B = (A + s) | 0
    else B = (A - (A >>> 0 < s >>> 0 ? 0 : s)) | 0
    s = (f + 4) | 0
    c[s >> 2] = (c[s >> 2] | 0) + B
    A = (f + 436 + ((v * 24) | 0) + 20) | 0
    u = c[n >> 2] | 0
    do
      if (!(a[A >> 0] | 0)) {
        z = (f + 436 + ((v * 24) | 0) + 4) | 0
        t = c[z >> 2] | 0
        if ((u | 0) >= (B | 0)) {
          if ((t | 0) < (B | 0)) {
            c[y >> 2] = t
            C = z
          } else C = y
          c[C >> 2] = B
          a[A >> 0] = 1
          break
        }
        c[y >> 2] = t
        c[z >> 2] = u
        z = (f + 436 + ((v * 24) | 0) + 16) | 0
        t = c[z >> 2] | 0
        p = (f + 436 + ((v * 24) | 0) + 12) | 0
        o = c[p >> 2] | 0
        if ((t | 0) < (B | 0)) {
          c[n >> 2] = o
          c[p >> 2] = t
          c[z >> 2] = B
          break
        }
        if ((o | 0) < (B | 0)) {
          c[n >> 2] = o
          c[p >> 2] = B
          break
        } else {
          c[n >> 2] = B
          break
        }
      } else {
        p = (f + 436 + ((v * 24) | 0) + 12) | 0
        o = c[p >> 2] | 0
        if ((B | 0) >= (u | 0)) {
          z = (f + 436 + ((v * 24) | 0) + 16) | 0
          if ((B | 0) < (o | 0)) {
            c[z >> 2] = o
            D = p
          } else D = z
          c[D >> 2] = B
          a[A >> 0] = 0
          break
        }
        c[(f + 436 + ((v * 24) | 0) + 16) >> 2] = o
        c[p >> 2] = u
        p = c[y >> 2] | 0
        o = (f + 436 + ((v * 24) | 0) + 4) | 0
        z = c[o >> 2] | 0
        if ((B | 0) < (p | 0)) {
          c[n >> 2] = z
          c[o >> 2] = p
          c[y >> 2] = B
          break
        }
        if ((B | 0) < (z | 0)) {
          c[n >> 2] = z
          c[o >> 2] = B
          break
        } else {
          c[n >> 2] = B
          break
        }
      }
    while (0)
    B = ((c[m >> 2] | 0) + (c[x >> 2] | 0)) | 0
    x = (f + 820 + (w << 2)) | 0
    w = c[x >> 2] | 0
    m =
      ((Jc(
        (f + 4700) | 0,
        g,
        ((c[(f + 4736) >> 2] | 0) +
          ((((B >>> 0 < 36 ? (B >>> 1) & 2147483646 : 18) | q) * 44) | 0)) |
          0
      ) |
        0) +
        w) |
      0
    w = c[(f + 4724) >> 2] | 0
    if ((m | 0) < 0) E = (m + w) | 0
    else E = (m - (m >>> 0 < w >>> 0 ? 0 : w)) | 0
    w = (f + 8) | 0
    c[w >> 2] = E
    c[x >> 2] = E
    E =
      d[f >> 0] |
      (d[(f + 1) >> 0] << 8) |
      (d[(f + 2) >> 0] << 16) |
      (d[(f + 3) >> 0] << 24)
    a[(h + 3) >> 0] = E >>> 24
    a[(h + 2) >> 0] = E >>> 16
    a[(h + 1) >> 0] = E >>> 8
    a[h >> 0] = E
    E =
      d[s >> 0] |
      (d[(s + 1) >> 0] << 8) |
      (d[(s + 2) >> 0] << 16) |
      (d[(s + 3) >> 0] << 24)
    a[(h + 7) >> 0] = E >>> 24
    a[(h + 6) >> 0] = E >>> 16
    a[(h + 5) >> 0] = E >>> 8
    a[(h + 4) >> 0] = E
    E =
      d[w >> 0] |
      (d[(w + 1) >> 0] << 8) |
      (d[(w + 2) >> 0] << 16) |
      (d[(w + 3) >> 0] << 24)
    a[(h + 11) >> 0] = E >>> 24
    a[(h + 10) >> 0] = E >>> 16
    a[(h + 9) >> 0] = E >>> 8
    a[(h + 8) >> 0] = E
    E = (f + 12) | 0
    w = d[E >> 0] | (d[(E + 1) >> 0] << 8)
    a[(h + 13) >> 0] = (w & 65535) >>> 8
    a[(h + 12) >> 0] = w
    a[(h + 14) >> 0] = a[(f + 14) >> 0] | 0
    a[(h + 15) >> 0] = a[(f + 15) >> 0] | 0
    a[(h + 16) >> 0] = a[(f + 16) >> 0] | 0
    a[(h + 17) >> 0] = a[(f + 17) >> 0] | 0
    w = (f + 18) | 0
    f = d[w >> 0] | (d[(w + 1) >> 0] << 8)
    a[(h + 19) >> 0] = (f & 65535) >>> 8
    a[(h + 18) >> 0] = f
    r = (h + 20) | 0
    return r | 0
  }
  function wd(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0
    f = (b + 8) | 0
    g = (b + 4) | 0
    h = c[g >> 2] | 0
    i = ((c[f >> 2] | 0) - h) | 0
    j = i >>> 0 > e >>> 0 ? e : i
    i = (b + 12) | 0
    k = ((c[i >> 2] | 0) + h) | 0
    l = (k + j) | 0
    if (!j) m = h
    else {
      h = k
      k = d
      while (1) {
        a[k >> 0] = a[h >> 0] | 0
        h = (h + 1) | 0
        if ((h | 0) == (l | 0)) break
        else k = (k + 1) | 0
      }
      m = c[g >> 2] | 0
    }
    c[g >> 2] = m + j
    m = (e - j) | 0
    if (!m) return
    c[g >> 2] = 0
    e = c[b >> 2] | 0
    k = c[i >> 2] | 0
    l = (e + 13) | 0
    if (!(a[l >> 0] | 0)) {
      h = (e + 4) | 0
      n = c[h >> 2] | 0
      o = (e + 8) | 0
      p = c[o >> 2] | 0
      q = (n - p) | 0
      r = (q | 0) < 1048576 ? q : 1048576
      if (!r) {
        s = p
        t = n
      } else {
        Ui(k | 0, ((c[e >> 2] | 0) + p) | 0, r | 0) | 0
        s = c[o >> 2] | 0
        t = c[h >> 2] | 0
      }
      h = (s + r) | 0
      c[o >> 2] = h
      c[(e + 16) >> 2] = r
      if ((h | 0) >= (t | 0)) a[l >> 0] = 1
    } else a[(e + 12) >> 0] = 1
    e = c[((c[b >> 2] | 0) + 16) >> 2] | 0
    c[f >> 2] = e
    if (!e) {
      e = I(8) | 0
      Dc(e)
      K(e | 0, 848, 8)
    }
    e = ((c[i >> 2] | 0) + (c[g >> 2] | 0)) | 0
    i = (e + m) | 0
    f = e
    e = (d + j) | 0
    while (1) {
      a[e >> 0] = a[f >> 0] | 0
      f = (f + 1) | 0
      if ((f | 0) == (i | 0)) break
      else e = (e + 1) | 0
    }
    c[g >> 2] = (c[g >> 2] | 0) + m
    return
  }
  function xd(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function yd(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function zd(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function Ad(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 6935 ? (a + 12) | 0 : 0) | 0
  }
  function Bd(a) {
    a = a | 0
    yh(a)
    return
  }
  function Cd(a) {
    a = a | 0
    c[a >> 2] = 2636
    yc((a + 252) | 0)
    ud((a + 172) | 0)
    Gd((a + 8) | 0)
    return
  }
  function Dd(a) {
    a = a | 0
    c[a >> 2] = 2636
    yc((a + 252) | 0)
    ud((a + 172) | 0)
    Gd((a + 8) | 0)
    yh(a)
    return
  }
  function Ed(a, b) {
    a = a | 0
    b = b | 0
    return Hd((a + 8) | 0, c[(a + 4) >> 2] | 0, b) | 0
  }
  function Fd(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0
    a[b >> 0] = 0
    Fc((b + 4) | 0, 516, 0, 0)
    d = (b + 48) | 0
    c[d >> 2] = 6
    a[(b + 52) >> 0] = 0
    c[(b + 80) >> 2] = 5
    c[(b + 64) >> 2] = 0
    c[(b + 88) >> 2] = 0
    c[(b + 84) >> 2] = 0
    e = fh(92) | 0
    f = (e + 68) & -64
    c[(f + -4) >> 2] = e
    c[(b + 56) >> 2] = f
    f = fh(92) | 0
    e = (f + 68) & -64
    c[(e + -4) >> 2] = f
    c[(b + 60) >> 2] = e
    c[(b + 68) >> 2] = 0
    f = (b + 72) | 0
    c[f >> 2] = 6
    g = e
    e = 0
    do {
      c[(g + (e << 2)) >> 2] = 1
      e = (e + 1) | 0
    } while (e >>> 0 < (c[d >> 2] | 0) >>> 0)
    Ic(d)
    e = (((c[d >> 2] | 0) + 6) | 0) >>> 1
    c[f >> 2] = e
    c[(b + 76) >> 2] = e
    e = (b + 92) | 0
    b = (e + 72) | 0
    do {
      c[e >> 2] = 0
      e = (e + 4) | 0
    } while ((e | 0) < (b | 0))
    return
  }
  function Gd(a) {
    a = a | 0
    var b = 0
    b = c[(a + 56) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 60) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 64) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 12) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 16) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 20) >> 2] | 0
    if (!b) return
    gh(c[(b + -4) >> 2] | 0)
    return
  }
  function Hd(b, e, f) {
    b = b | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      w = 0,
      x = 0,
      y = 0
    g = (b + 325) | 0
    if (!(a[g >> 0] | 0)) {
      xc((b + 244) | 0)
      a[g >> 0] = 1
    }
    if (!(a[b >> 0] | 0)) {
      a[b >> 0] = 1
      wd(c[e >> 2] | 0, f, 8)
      g =
        (d[(f + 1) >> 0] << 8) |
        d[f >> 0] |
        (d[(f + 2) >> 0] << 16) |
        (d[(f + 3) >> 0] << 24)
      h =
        (d[(f + 5) >> 0] << 8) |
        d[(f + 4) >> 0] |
        (d[(f + 6) >> 0] << 16) |
        (d[(f + 7) >> 0] << 24)
      i = (b + 100) | 0
      j = i
      a[j >> 0] = g
      a[(j + 1) >> 0] = g >> 8
      a[(j + 2) >> 0] = g >> 16
      a[(j + 3) >> 0] = g >> 24
      g = (i + 4) | 0
      a[g >> 0] = h
      a[(g + 1) >> 0] = h >> 8
      a[(g + 2) >> 0] = h >> 16
      a[(g + 3) >> 0] = h >> 24
      k = (f + 8) | 0
      return k | 0
    }
    h = (b + 92) | 0
    a: do
      if (!(c[(b + 132 + (c[h >> 2] << 2)) >> 2] | 0)) {
        g = Kc(e, (b + 48) | 0) | 0
        switch (g | 0) {
          case 1: {
            i = Jc((b + 244) | 0, e, c[(b + 280) >> 2] | 0) | 0
            j = c[(b + 268) >> 2] | 0
            if ((i | 0) < 0) l = (j + i) | 0
            else l = (i - (i >>> 0 < j >>> 0 ? 0 : j)) | 0
            c[(b + 132 + (c[h >> 2] << 2)) >> 2] = l
            j = c[h >> 2] | 0
            i = c[(b + 132 + (j << 2)) >> 2] | 0
            m = (b + 100 + (j << 3)) | 0
            n = m
            o = n
            p = (n + 4) | 0
            n =
              Mi(
                d[o >> 0] |
                  (d[(o + 1) >> 0] << 8) |
                  (d[(o + 2) >> 0] << 16) |
                  (d[(o + 3) >> 0] << 24) |
                  0,
                d[p >> 0] |
                  (d[(p + 1) >> 0] << 8) |
                  (d[(p + 2) >> 0] << 16) |
                  (d[(p + 3) >> 0] << 24) |
                  0,
                i | 0,
                ((((i | 0) < 0) << 31) >> 31) | 0
              ) | 0
            i = v() | 0
            p = m
            m = p
            a[m >> 0] = n
            a[(m + 1) >> 0] = n >> 8
            a[(m + 2) >> 0] = n >> 16
            a[(m + 3) >> 0] = n >> 24
            n = (p + 4) | 0
            a[n >> 0] = i
            a[(n + 1) >> 0] = i >> 8
            a[(n + 2) >> 0] = i >> 16
            a[(n + 3) >> 0] = i >> 24
            c[(b + 148 + (j << 2)) >> 2] = 0
            break a
            break
          }
          case 2: {
            j = (b + 96) | 0
            c[j >> 2] = ((c[j >> 2] | 0) + 1) & 3
            i = (b + 100 + (c[h >> 2] << 3) + 4) | 0
            n =
              ((d[i >> 0] |
                (d[(i + 1) >> 0] << 8) |
                (d[(i + 2) >> 0] << 16) |
                (d[(i + 3) >> 0] << 24)) +
                (Jc((b + 244) | 0, e, ((c[(b + 280) >> 2] | 0) + 352) | 0) |
                  0)) |
              0
            i = c[(b + 268) >> 2] | 0
            if ((n | 0) < 0) q = (n + i) | 0
            else q = (n - (n >>> 0 < i >>> 0 ? 0 : i)) | 0
            i = (b + 100 + (c[j >> 2] << 3)) | 0
            n = i
            a[n >> 0] = 0
            a[(n + 1) >> 0] = 0
            a[(n + 2) >> 0] = 0
            a[(n + 3) >> 0] = 0
            n = (i + 4) | 0
            a[n >> 0] = q
            a[(n + 1) >> 0] = q >> 8
            a[(n + 2) >> 0] = q >> 16
            a[(n + 3) >> 0] = q >> 24
            n = ((Nc(e) | 0) & 65535) | (((Nc(e) | 0) & 65535) << 16)
            i = c[j >> 2] | 0
            j = (b + 100 + (i << 3)) | 0
            p = j
            m = p
            o = (p + 4) | 0
            p =
              d[o >> 0] |
              (d[(o + 1) >> 0] << 8) |
              (d[(o + 2) >> 0] << 16) |
              (d[(o + 3) >> 0] << 24)
            o =
              d[m >> 0] |
              (d[(m + 1) >> 0] << 8) |
              (d[(m + 2) >> 0] << 16) |
              (d[(m + 3) >> 0] << 24) |
              n
            n = j
            j = n
            a[j >> 0] = o
            a[(j + 1) >> 0] = o >> 8
            a[(j + 2) >> 0] = o >> 16
            a[(j + 3) >> 0] = o >> 24
            o = (n + 4) | 0
            a[o >> 0] = p
            a[(o + 1) >> 0] = p >> 8
            a[(o + 2) >> 0] = p >> 16
            a[(o + 3) >> 0] = p >> 24
            c[h >> 2] = i
            c[(b + 132 + (i << 2)) >> 2] = 0
            c[(b + 148 + (c[h >> 2] << 2)) >> 2] = 0
            break a
            break
          }
          default: {
            if ((g | 0) <= 2) break a
            c[h >> 2] = (g + 2 + (c[h >> 2] | 0)) & 3
            Hd(b, e, f) | 0
            break a
          }
        }
      } else {
        g = Kc(e, (b + 4) | 0) | 0
        if ((g | 0) == 1) {
          i = c[(b + 132 + (c[h >> 2] << 2)) >> 2] | 0
          p =
            ((Jc((b + 244) | 0, e, ((c[(b + 280) >> 2] | 0) + 44) | 0) | 0) +
              i) |
            0
          i = c[(b + 268) >> 2] | 0
          if ((p | 0) < 0) s = (p + i) | 0
          else s = (p - (p >>> 0 < i >>> 0 ? 0 : i)) | 0
          i = c[h >> 2] | 0
          p = (b + 100 + (i << 3)) | 0
          o = p
          n = o
          j = (o + 4) | 0
          o =
            Mi(
              d[n >> 0] |
                (d[(n + 1) >> 0] << 8) |
                (d[(n + 2) >> 0] << 16) |
                (d[(n + 3) >> 0] << 24) |
                0,
              d[j >> 0] |
                (d[(j + 1) >> 0] << 8) |
                (d[(j + 2) >> 0] << 16) |
                (d[(j + 3) >> 0] << 24) |
                0,
              s | 0,
              ((((s | 0) < 0) << 31) >> 31) | 0
            ) | 0
          j = v() | 0
          n = p
          p = n
          a[p >> 0] = o
          a[(p + 1) >> 0] = o >> 8
          a[(p + 2) >> 0] = o >> 16
          a[(p + 3) >> 0] = o >> 24
          o = (n + 4) | 0
          a[o >> 0] = j
          a[(o + 1) >> 0] = j >> 8
          a[(o + 2) >> 0] = j >> 16
          a[(o + 3) >> 0] = j >> 24
          c[(b + 148 + (i << 2)) >> 2] = 0
          break
        }
        if ((g | 0) >= 511) {
          if ((g | 0) != 512) {
            if ((g | 0) <= 511) break
            c[h >> 2] = ((c[h >> 2] | 0) + g) & 3
            Hd(b, e, f) | 0
            break
          }
          i = (b + 96) | 0
          c[i >> 2] = ((c[i >> 2] | 0) + 1) & 3
          j = (b + 100 + (c[h >> 2] << 3) + 4) | 0
          o =
            d[j >> 0] |
            (d[(j + 1) >> 0] << 8) |
            (d[(j + 2) >> 0] << 16) |
            (d[(j + 3) >> 0] << 24)
          j =
            ((Jc((b + 244) | 0, e, ((c[(b + 280) >> 2] | 0) + 352) | 0) | 0) +
              o) |
            0
          o = c[(b + 268) >> 2] | 0
          if ((j | 0) < 0) t = (j + o) | 0
          else t = (j - (j >>> 0 < o >>> 0 ? 0 : o)) | 0
          o = (b + 100 + (c[i >> 2] << 3)) | 0
          j = o
          a[j >> 0] = 0
          a[(j + 1) >> 0] = 0
          a[(j + 2) >> 0] = 0
          a[(j + 3) >> 0] = 0
          j = (o + 4) | 0
          a[j >> 0] = t
          a[(j + 1) >> 0] = t >> 8
          a[(j + 2) >> 0] = t >> 16
          a[(j + 3) >> 0] = t >> 24
          j = (Nc(e) | 0) & 65535
          o = (((Nc(e) | 0) & 65535) << 16) | j
          j = c[i >> 2] | 0
          i = (b + 100 + (j << 3)) | 0
          n = i
          p = n
          m = (n + 4) | 0
          n =
            d[m >> 0] |
            (d[(m + 1) >> 0] << 8) |
            (d[(m + 2) >> 0] << 16) |
            (d[(m + 3) >> 0] << 24)
          m =
            d[p >> 0] |
            (d[(p + 1) >> 0] << 8) |
            (d[(p + 2) >> 0] << 16) |
            (d[(p + 3) >> 0] << 24) |
            o
          o = i
          i = o
          a[i >> 0] = m
          a[(i + 1) >> 0] = m >> 8
          a[(i + 2) >> 0] = m >> 16
          a[(i + 3) >> 0] = m >> 24
          m = (o + 4) | 0
          a[m >> 0] = n
          a[(m + 1) >> 0] = n >> 8
          a[(m + 2) >> 0] = n >> 16
          a[(m + 3) >> 0] = n >> 24
          c[h >> 2] = j
          c[(b + 132 + (j << 2)) >> 2] = 0
          c[(b + 148 + (c[h >> 2] << 2)) >> 2] = 0
          break
        }
        do
          if (!g) {
            j = Jc((b + 244) | 0, e, ((c[(b + 280) >> 2] | 0) + 308) | 0) | 0
            n = c[(b + 268) >> 2] | 0
            if ((j | 0) < 0) u = (n + j) | 0
            else u = (j - (j >>> 0 < n >>> 0 ? 0 : n)) | 0
            n = (b + 148 + (c[h >> 2] << 2)) | 0
            c[n >> 2] = (c[n >> 2] | 0) + 1
            n = c[h >> 2] | 0
            if ((c[(b + 148 + (n << 2)) >> 2] | 0) > 3) {
              c[(b + 132 + (n << 2)) >> 2] = u
              c[(b + 148 + (c[h >> 2] << 2)) >> 2] = 0
              w = u
            } else w = u
          } else {
            if ((g | 0) < 500) {
              n = (b + 244) | 0
              j = r(c[(b + 132 + (c[h >> 2] << 2)) >> 2] | 0, g) | 0
              m = c[(b + 280) >> 2] | 0
              if ((g | 0) < 10) {
                o = ((Jc(n, e, (m + 88) | 0) | 0) + j) | 0
                i = c[(b + 268) >> 2] | 0
                if ((o | 0) < 0) {
                  w = (o + i) | 0
                  break
                } else {
                  w = (o - (o >>> 0 < i >>> 0 ? 0 : i)) | 0
                  break
                }
              } else {
                i = ((Jc(n, e, (m + 132) | 0) | 0) + j) | 0
                j = c[(b + 268) >> 2] | 0
                if ((i | 0) < 0) {
                  w = (i + j) | 0
                  break
                } else {
                  w = (i - (i >>> 0 < j >>> 0 ? 0 : j)) | 0
                  break
                }
              }
            }
            if ((g | 0) == 500) {
              j = ((c[(b + 132 + (c[h >> 2] << 2)) >> 2] | 0) * 500) | 0
              i =
                ((Jc((b + 244) | 0, e, ((c[(b + 280) >> 2] | 0) + 176) | 0) |
                  0) +
                  j) |
                0
              j = c[(b + 268) >> 2] | 0
              if ((i | 0) < 0) x = (i + j) | 0
              else x = (i - (i >>> 0 < j >>> 0 ? 0 : j)) | 0
              j = (b + 148 + (c[h >> 2] << 2)) | 0
              c[j >> 2] = (c[j >> 2] | 0) + 1
              j = c[h >> 2] | 0
              if ((c[(b + 148 + (j << 2)) >> 2] | 0) <= 3) {
                w = x
                break
              }
              c[(b + 132 + (j << 2)) >> 2] = x
              c[(b + 148 + (c[h >> 2] << 2)) >> 2] = 0
              w = x
              break
            }
            j = (500 - g) | 0
            i = (b + 244) | 0
            m = c[(b + 132 + (c[h >> 2] << 2)) >> 2] | 0
            if ((j | 0) > -10) {
              n = r(m, j) | 0
              j = ((Jc(i, e, ((c[(b + 280) >> 2] | 0) + 220) | 0) | 0) + n) | 0
              n = c[(b + 268) >> 2] | 0
              if ((j | 0) < 0) {
                w = (j + n) | 0
                break
              } else {
                w = (j - (j >>> 0 < n >>> 0 ? 0 : n)) | 0
                break
              }
            }
            n = r(m, -10) | 0
            m = ((Jc(i, e, ((c[(b + 280) >> 2] | 0) + 264) | 0) | 0) + n) | 0
            n = c[(b + 268) >> 2] | 0
            if ((m | 0) < 0) y = (m + n) | 0
            else y = (m - (m >>> 0 < n >>> 0 ? 0 : n)) | 0
            n = (b + 148 + (c[h >> 2] << 2)) | 0
            c[n >> 2] = (c[n >> 2] | 0) + 1
            n = c[h >> 2] | 0
            if ((c[(b + 148 + (n << 2)) >> 2] | 0) > 3) {
              c[(b + 132 + (n << 2)) >> 2] = y
              c[(b + 148 + (c[h >> 2] << 2)) >> 2] = 0
              w = y
            } else w = y
          }
        while (0)
        g = (b + 100 + (c[h >> 2] << 3)) | 0
        n = g
        m = n
        i = (n + 4) | 0
        n =
          Mi(
            d[m >> 0] |
              (d[(m + 1) >> 0] << 8) |
              (d[(m + 2) >> 0] << 16) |
              (d[(m + 3) >> 0] << 24) |
              0,
            d[i >> 0] |
              (d[(i + 1) >> 0] << 8) |
              (d[(i + 2) >> 0] << 16) |
              (d[(i + 3) >> 0] << 24) |
              0,
            w | 0,
            ((((w | 0) < 0) << 31) >> 31) | 0
          ) | 0
        i = v() | 0
        m = g
        g = m
        a[g >> 0] = n
        a[(g + 1) >> 0] = n >> 8
        a[(g + 2) >> 0] = n >> 16
        a[(g + 3) >> 0] = n >> 24
        n = (m + 4) | 0
        a[n >> 0] = i
        a[(n + 1) >> 0] = i >> 8
        a[(n + 2) >> 0] = i >> 16
        a[(n + 3) >> 0] = i >> 24
      }
    while (0)
    w = (b + 100 + (c[h >> 2] << 3)) | 0
    h = w
    b =
      d[h >> 0] |
      (d[(h + 1) >> 0] << 8) |
      (d[(h + 2) >> 0] << 16) |
      (d[(h + 3) >> 0] << 24)
    a[(f + 3) >> 0] = b >>> 24
    a[(f + 2) >> 0] = b >>> 16
    a[(f + 1) >> 0] = b >>> 8
    a[f >> 0] = b
    b = w
    w = b
    h =
      d[w >> 0] |
      (d[(w + 1) >> 0] << 8) |
      (d[(w + 2) >> 0] << 16) |
      (d[(w + 3) >> 0] << 24)
    w = (b + 4) | 0
    b =
      d[w >> 0] |
      (d[(w + 1) >> 0] << 8) |
      (d[(w + 2) >> 0] << 16) |
      (d[(w + 3) >> 0] << 24)
    w = Ri(h | 0, b | 0, 56) | 0
    v() | 0
    a[(f + 7) >> 0] = w
    w = Ri(h | 0, b | 0, 48) | 0
    v() | 0
    a[(f + 6) >> 0] = w
    w = Ri(h | 0, b | 0, 40) | 0
    v() | 0
    a[(f + 5) >> 0] = w
    a[(f + 4) >> 0] = b
    k = (f + 8) | 0
    return k | 0
  }
  function Id(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Jd(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function Kd(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 7623 ? (a + 12) | 0 : 0) | 0
  }
  function Ld(a) {
    a = a | 0
    yh(a)
    return
  }
  function Md(d) {
    d = d | 0
    c[d >> 2] = 0
    b[(d + 4) >> 1] = 0
    a[(d + 6) >> 0] = 0
    Fc((d + 8) | 0, 128, 0, 0)
    Fc((d + 52) | 0, 256, 0, 0)
    Fc((d + 96) | 0, 256, 0, 0)
    Fc((d + 140) | 0, 256, 0, 0)
    Fc((d + 184) | 0, 256, 0, 0)
    Fc((d + 228) | 0, 256, 0, 0)
    Fc((d + 272) | 0, 256, 0, 0)
    return
  }
  function Nd(a) {
    a = a | 0
    c[a >> 2] = 2688
    Qd((a + 8) | 0)
    return
  }
  function Od(a) {
    a = a | 0
    c[a >> 2] = 2688
    Qd((a + 8) | 0)
    yh(a)
    return
  }
  function Pd(a, b) {
    a = a | 0
    b = b | 0
    return Rd((a + 8) | 0, c[(a + 4) >> 2] | 0, b) | 0
  }
  function Qd(a) {
    a = a | 0
    var b = 0
    b = c[(a + 280) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 284) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 288) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 236) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 240) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 244) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 192) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 196) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 200) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 148) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 152) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 156) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 104) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 108) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 112) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 60) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 64) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 68) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 16) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 20) >> 2] | 0
    if (b | 0) gh(c[(b + -4) >> 2] | 0)
    b = c[(a + 24) >> 2] | 0
    if (!b) return
    gh(c[(b + -4) >> 2] | 0)
    return
  }
  function Rd(b, e, f) {
    b = b | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0
    if (!(a[b >> 0] | 0)) {
      a[b >> 0] = 1
      wd(c[e >> 2] | 0, f, 6)
      g = ((a[(f + 1) >> 0] << 8) | d[f >> 0]) & 65535
      h = ((a[(f + 3) >> 0] << 8) | d[(f + 2) >> 0]) & 65535
      i = ((a[(f + 5) >> 0] << 8) | d[(f + 4) >> 0]) & 65535
      j = (b + 1) | 0
      a[j >> 0] = g
      a[(j + 1) >> 0] = g >> 8
      g = (b + 3) | 0
      a[g >> 0] = h
      a[(g + 1) >> 0] = h >> 8
      h = (b + 5) | 0
      a[h >> 0] = i
      a[(h + 1) >> 0] = i >> 8
      k = (f + 6) | 0
      return k | 0
    }
    i = Kc(e, (b + 8) | 0) | 0
    if (!(i & 1)) {
      h = (b + 1) | 0
      g = d[h >> 0] | (d[(h + 1) >> 0] << 8)
      l = g
      m = g
    } else {
      g = Kc(e, (b + 52) | 0) | 0
      h = (b + 1) | 0
      j = d[h >> 0] | (d[(h + 1) >> 0] << 8)
      l = (g + (j & 65535)) & 65535
      m = j
    }
    j = l & 255
    if (!(i & 2)) {
      n = (m & -256) | j
      o = m
    } else {
      m = Kc(e, (b + 96) | 0) | 0
      l = (b + 1) | 0
      g = d[l >> 0] | (d[(l + 1) >> 0] << 8)
      n = ((((m << 8) + (g & 65535)) & 65280) | (j & 65535)) & 65535
      o = g
    }
    do
      if (i & 64) {
        g = (b + 1) | 0
        j = ((n & 255) - (o & 255)) | 0
        if (!(i & 4)) {
          m = (b + 3) | 0
          l = d[m >> 0] | (d[(m + 1) >> 0] << 8)
          p = l
          q = l
        } else {
          l = Kc(e, (b + 140) | 0) | 0
          m = (b + 3) | 0
          h = d[m >> 0] | (d[(m + 1) >> 0] << 8)
          m = (j + (h & 255)) | 0
          p = (((m | 0) < 1 ? 0 : (m | 0) < 255 ? m : 255) + l) & 65535
          q = h
        }
        h = p & 255
        if (!(i & 16)) {
          l = (b + 5) | 0
          r = d[l >> 0] | (d[(l + 1) >> 0] << 8)
          s = q
        } else {
          l = Kc(e, (b + 228) | 0) | 0
          m = (b + 3) | 0
          t = d[m >> 0] | (d[(m + 1) >> 0] << 8)
          m = (b + 5) | 0
          u =
            (((((j + (h & 65535) - (t & 255)) | 0) / 2) | 0) +
              ((d[m >> 0] | (d[(m + 1) >> 0] << 8)) & 255)) |
            0
          r = (((u | 0) < 1 ? 0 : (u | 0) < 255 ? u : 255) + l) & 65535
          s = t
        }
        t = r & 255
        l =
          (((n & 65535) >>> 8) -
            (((d[g >> 0] | (d[(g + 1) >> 0] << 8)) & 65535) >>> 8)) |
          0
        if (!(i & 8)) v = (s & -256) | h
        else {
          u = Kc(e, (b + 184) | 0) | 0
          m = (b + 3) | 0
          j = ((((d[m >> 0] | (d[(m + 1) >> 0] << 8)) & 65535) >>> 8) + l) | 0
          v =
            (((((j | 0) < 1 ? 0 : (j | 0) < 255 ? j : 255) + u) << 8) |
              (h & 65535)) &
            65535
        }
        if (!(i & 32)) {
          h = (b + 5) | 0
          w = g
          x = v
          y = h
          z = ((d[h >> 0] | (d[(h + 1) >> 0] << 8)) & -256) | t
          break
        } else {
          h = Kc(e, (b + 272) | 0) | 0
          u = (b + 3) | 0
          j = (b + 5) | 0
          m =
            (((((((v & 65535) >>> 8) +
              l -
              (((d[u >> 0] | (d[(u + 1) >> 0] << 8)) & 65535) >>> 8)) |
              0) /
              2) |
              0) +
              (((d[j >> 0] | (d[(j + 1) >> 0] << 8)) & 65535) >>> 8)) |
            0
          w = g
          x = v
          y = j
          z =
            (((((m | 0) < 1 ? 0 : (m | 0) < 255 ? m : 255) + h) << 8) |
              (t & 65535)) &
            65535
          break
        }
      } else {
        w = (b + 1) | 0
        x = n
        y = (b + 5) | 0
        z = n
      }
    while (0)
    a[w >> 0] = n
    a[(w + 1) >> 0] = n >> 8
    w = (b + 3) | 0
    a[w >> 0] = x
    a[(w + 1) >> 0] = x >> 8
    a[y >> 0] = z
    a[(y + 1) >> 0] = z >> 8
    a[(f + 1) >> 0] = (n & 65535) >>> 8
    a[f >> 0] = n
    n = d[w >> 0] | (d[(w + 1) >> 0] << 8)
    a[(f + 3) >> 0] = (n & 65535) >>> 8
    a[(f + 2) >> 0] = n
    n = d[y >> 0] | (d[(y + 1) >> 0] << 8)
    a[(f + 5) >> 0] = (n & 65535) >>> 8
    a[(f + 4) >> 0] = n
    k = (f + 6) | 0
    return k | 0
  }
  function Sd(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Td(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function Ud(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 8303 ? (a + 12) | 0 : 0) | 0
  }
  function Vd(a) {
    a = a | 0
    yh(a)
    return
  }
  function Wd(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0
    c[b >> 2] = c[d >> 2]
    a[(b + 4) >> 0] = a[(d + 4) >> 0] | 0
    e = (b + 8) | 0
    f = (d + 8) | 0
    c[e >> 2] = 0
    g = (b + 12) | 0
    c[g >> 2] = 0
    h = (b + 16) | 0
    c[h >> 2] = 0
    i = (d + 12) | 0
    j = ((c[i >> 2] | 0) - (c[f >> 2] | 0)) | 0
    if (j | 0) {
      if ((j | 0) < 0) Jh(e)
      k = wh(j) | 0
      c[g >> 2] = k
      c[e >> 2] = k
      c[h >> 2] = k + j
      j = c[f >> 2] | 0
      f = ((c[i >> 2] | 0) - j) | 0
      if ((f | 0) > 0) {
        Ti(k | 0, j | 0, f | 0) | 0
        c[g >> 2] = k + f
      }
    }
    f = (b + 20) | 0
    k = (d + 20) | 0
    c[f >> 2] = 0
    g = (b + 24) | 0
    c[g >> 2] = 0
    j = (b + 28) | 0
    c[j >> 2] = 0
    i = (d + 24) | 0
    h = ((c[i >> 2] | 0) - (c[k >> 2] | 0)) | 0
    if (!h) {
      l = (b + 32) | 0
      m = (d + 32) | 0
      _d(l, m)
      return
    }
    if ((h | 0) < 0) Jh(f)
    e = wh(h) | 0
    c[g >> 2] = e
    c[f >> 2] = e
    c[j >> 2] = e + h
    h = c[k >> 2] | 0
    k = ((c[i >> 2] | 0) - h) | 0
    if ((k | 0) <= 0) {
      l = (b + 32) | 0
      m = (d + 32) | 0
      _d(l, m)
      return
    }
    Ti(e | 0, h | 0, k | 0) | 0
    c[g >> 2] = e + k
    l = (b + 32) | 0
    m = (d + 32) | 0
    _d(l, m)
    return
  }
  function Xd(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0
    c[a >> 2] = 2740
    b = (a + 40) | 0
    fe(b)
    d = (a + 44) | 0
    e = c[d >> 2] | 0
    f = (a + 48) | 0
    g = c[f >> 2] | 0
    if ((e | 0) != (g | 0)) {
      h = e
      do {
        yh(c[h >> 2] | 0)
        h = (h + 4) | 0
      } while ((h | 0) != (g | 0))
      g = c[d >> 2] | 0
      d = c[f >> 2] | 0
      if ((d | 0) != (g | 0)) c[f >> 2] = d + (~(((d + -4 - g) | 0) >>> 2) << 2)
    }
    g = c[b >> 2] | 0
    if (g | 0) yh(g)
    g = c[(a + 28) >> 2] | 0
    if (g | 0) {
      c[(a + 32) >> 2] = g
      yh(g)
    }
    g = c[(a + 16) >> 2] | 0
    if (!g) return
    c[(a + 20) >> 2] = g
    yh(g)
    return
  }
  function Yd(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0
    c[a >> 2] = 2740
    b = (a + 40) | 0
    fe(b)
    d = (a + 44) | 0
    e = c[d >> 2] | 0
    f = (a + 48) | 0
    g = c[f >> 2] | 0
    if ((e | 0) != (g | 0)) {
      h = e
      do {
        yh(c[h >> 2] | 0)
        h = (h + 4) | 0
      } while ((h | 0) != (g | 0))
      g = c[d >> 2] | 0
      d = c[f >> 2] | 0
      if ((d | 0) != (g | 0)) c[f >> 2] = d + (~(((d + -4 - g) | 0) >>> 2) << 2)
    }
    g = c[b >> 2] | 0
    if (g | 0) yh(g)
    g = c[(a + 28) >> 2] | 0
    if (g | 0) {
      c[(a + 32) >> 2] = g
      yh(g)
    }
    g = c[(a + 16) >> 2] | 0
    if (!g) {
      yh(a)
      return
    }
    c[(a + 20) >> 2] = g
    yh(g)
    yh(a)
    return
  }
  function Zd(b, e) {
    b = b | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0
    f = c[(b + 4) >> 2] | 0
    g = (b + 12) | 0
    if (!(a[g >> 0] | 0)) {
      h = (b + 8) | 0
      wd(c[f >> 2] | 0, e, c[h >> 2] | 0)
      i = c[h >> 2] | 0
      j = (e + i) | 0
      if (!i) k = 0
      else {
        i = e
        l = c[(b + 16) >> 2] | 0
        while (1) {
          a[l >> 0] = a[i >> 0] | 0
          i = (i + 1) | 0
          if ((i | 0) == (j | 0)) break
          else l = (l + 1) | 0
        }
        k = c[h >> 2] | 0
      }
      a[g >> 0] = 1
      m = (e + k) | 0
      return m | 0
    }
    k = c[(b + 16) >> 2] | 0
    g = c[(b + 44) >> 2] | 0
    h = c[(b + 56) >> 2] | 0
    l = ((h >>> 0) / 93) | 0
    j = (g + (l << 2)) | 0
    if ((c[(b + 48) >> 2] | 0) == (g | 0)) n = 0
    else n = ((c[j >> 2] | 0) + ((((h - ((l * 93) | 0)) | 0) * 44) | 0)) | 0
    l = (b + 20) | 0
    if ((k | 0) == (c[l >> 2] | 0)) {
      m = e
      return m | 0
    }
    h = e
    e = j
    j = k
    k = c[(b + 28) >> 2] | 0
    b = n
    while (1) {
      n = d[j >> 0] | 0
      g = b
      i = ((Kc(f, g) | 0) + n) & 255
      a[k >> 0] = i
      a[h >> 0] = i
      a[j >> 0] = i
      j = (j + 1) | 0
      i = (h + 1) | 0
      n = (g + 44) | 0
      if (((n - (c[e >> 2] | 0)) | 0) == 4092) {
        g = (e + 4) | 0
        o = g
        p = c[g >> 2] | 0
      } else {
        o = e
        p = n
      }
      if ((j | 0) == (c[l >> 2] | 0)) {
        m = i
        break
      } else {
        h = i
        e = o
        k = (k + 1) | 0
        b = p
      }
    }
    return m | 0
  }
  function _d(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0
    d = eb
    eb = (eb + 32) | 0
    e = (d + 24) | 0
    f = (d + 16) | 0
    g = (d + 8) | 0
    h = d
    c[a >> 2] = 0
    c[(a + 4) >> 2] = 0
    c[(a + 8) >> 2] = 0
    c[(a + 12) >> 2] = 0
    c[(a + 16) >> 2] = 0
    c[(a + 20) >> 2] = 0
    i = c[(b + 4) >> 2] | 0
    j = c[(b + 16) >> 2] | 0
    k = ((j >>> 0) / 93) | 0
    l = (i + (k << 2)) | 0
    m = (c[(b + 8) >> 2] | 0) == (i | 0)
    if (m) n = 0
    else n = ((c[l >> 2] | 0) + ((((j - ((k * 93) | 0)) | 0) * 44) | 0)) | 0
    c[g >> 2] = l
    c[(g + 4) >> 2] = n
    n = ((c[(b + 20) >> 2] | 0) + j) | 0
    j = ((n >>> 0) / 93) | 0
    b = (i + (j << 2)) | 0
    if (m) o = 0
    else o = ((c[b >> 2] | 0) + ((((n - ((j * 93) | 0)) | 0) * 44) | 0)) | 0
    c[h >> 2] = b
    c[(h + 4) >> 2] = o
    c[f >> 2] = c[g >> 2]
    c[(f + 4) >> 2] = c[(g + 4) >> 2]
    c[e >> 2] = c[h >> 2]
    c[(e + 4) >> 2] = c[(h + 4) >> 2]
    $d(a, f, e, 0)
    eb = d
    return
  }
  function $d(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0
    e = b
    f = c[e >> 2] | 0
    g = c[(e + 4) >> 2] | 0
    e = d
    h = c[e >> 2] | 0
    i = c[(e + 4) >> 2] | 0
    if ((i | 0) == (g | 0)) j = 0
    else
      j =
        (((((i - (c[h >> 2] | 0)) | 0) / 44) | 0) +
          ((((h - f) >> 2) * 93) | 0) +
          ((((g - (c[f >> 2] | 0)) | 0) / -44) | 0)) |
        0
    g = (a + 8) | 0
    h = c[g >> 2] | 0
    i = (a + 4) | 0
    e = c[i >> 2] | 0
    k = (h - e) | 0
    l = (a + 16) | 0
    m = (a + 20) | 0
    n = ((c[m >> 2] | 0) + (c[l >> 2] | 0)) | 0
    o = (((k | 0) == 0 ? 0 : ((((k >> 2) * 93) | 0) + -1) | 0) - n) | 0
    if (j >>> 0 > o >>> 0) {
      ae(a, (j - o) | 0)
      p = ((c[l >> 2] | 0) + (c[m >> 2] | 0)) | 0
      q = c[i >> 2] | 0
      r = c[g >> 2] | 0
    } else {
      p = n
      q = e
      r = h
    }
    h = ((p >>> 0) / 93) | 0
    e = (q + (h << 2)) | 0
    if ((r | 0) == (q | 0)) s = 0
    else s = ((c[e >> 2] | 0) + ((((p - ((h * 93) | 0)) | 0) * 44) | 0)) | 0
    h = (b + 4) | 0
    p = c[h >> 2] | 0
    q = c[(d + 4) >> 2] | 0
    if ((p | 0) == (q | 0)) return
    d = e
    e = s
    s = p
    p = f
    while (1) {
      f = e
      Hc(f, s)
      r = (f + 44) | 0
      if (((r - (c[d >> 2] | 0)) | 0) == 4092) {
        f = (d + 4) | 0
        t = f
        u = c[f >> 2] | 0
      } else {
        t = d
        u = r
      }
      r = (s + 44) | 0
      c[h >> 2] = r
      if (((r - (c[p >> 2] | 0)) | 0) == 4092) {
        f = (p + 4) | 0
        c[b >> 2] = f
        n = c[f >> 2] | 0
        c[h >> 2] = n
        v = n
        w = f
      } else {
        v = r
        w = p
      }
      c[m >> 2] = (c[m >> 2] | 0) + 1
      if ((v | 0) == (q | 0)) break
      else {
        d = t
        e = u
        s = v
        p = w
      }
    }
    return
  }
  function ae(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0,
      J = 0,
      L = 0,
      M = 0,
      N = 0,
      O = 0,
      P = 0,
      Q = 0,
      R = 0,
      S = 0,
      T = 0,
      U = 0,
      V = 0,
      W = 0,
      X = 0,
      Y = 0,
      Z = 0,
      _ = 0,
      $ = 0,
      aa = 0,
      ba = 0,
      ca = 0
    d = eb
    eb = (eb + 32) | 0
    e = (d + 4) | 0
    f = d
    g = (a + 8) | 0
    h = c[g >> 2] | 0
    i = (a + 4) | 0
    j = c[i >> 2] | 0
    k = ((((h | 0) == (j | 0)) & 1) + b) | 0
    b = ((k >>> 0) / 93) | 0
    l = (b + ((((k - ((b * 93) | 0)) | 0) != 0) & 1)) | 0
    b = (a + 16) | 0
    k = c[b >> 2] | 0
    m = ((k >>> 0) / 93) | 0
    n = l >>> 0 < m >>> 0 ? l : m
    o = (l - n) | 0
    p = h
    if (!o) {
      c[b >> 2] = (r(n, -93) | 0) + k
      if (!n) {
        eb = d
        return
      }
      k = (a + 12) | 0
      q = n
      s = j
      t = h
      a: while (1) {
        h = c[s >> 2] | 0
        u = (s + 4) | 0
        c[i >> 2] = u
        v = c[k >> 2] | 0
        w = v
        do
          if ((t | 0) == (v | 0)) {
            x = u
            y = c[a >> 2] | 0
            z = y
            if (u >>> 0 > y >>> 0) {
              A = (((((x - z) >> 2) + 1) | 0) / -2) | 0
              B = (u + (A << 2)) | 0
              C = (w - x) | 0
              if (!C) D = B
              else {
                Ui(B | 0, u | 0, C | 0) | 0
                D = ((c[i >> 2] | 0) + (A << 2)) | 0
              }
              A = (B + ((C >> 2) << 2)) | 0
              c[g >> 2] = A
              c[i >> 2] = D
              E = A
              break
            }
            A = (w - z) | 0
            z = (A | 0) == 0 ? 1 : A >> 1
            A = z >>> 2
            if (!z) F = 0
            else {
              if (z >>> 0 > 1073741823) {
                G = 11
                break a
              }
              F = wh(z << 2) | 0
            }
            C = F
            B = (F + (A << 2)) | 0
            H = B
            J = (F + (z << 2)) | 0
            if ((u | 0) == (t | 0)) {
              L = H
              M = y
            } else {
              y = ((((t + -4 - x) | 0) >>> 2) + 1) | 0
              x = B
              B = u
              while (1) {
                c[x >> 2] = c[B >> 2]
                B = (B + 4) | 0
                if ((B | 0) == (t | 0)) break
                else x = (x + 4) | 0
              }
              L = (F + ((y + A) << 2)) | 0
              M = c[a >> 2] | 0
            }
            c[a >> 2] = C
            c[i >> 2] = H
            c[g >> 2] = L
            c[k >> 2] = J
            if (!M) E = L
            else {
              yh(M)
              E = c[g >> 2] | 0
            }
          } else E = t
        while (0)
        c[E >> 2] = h
        u = ((c[g >> 2] | 0) + 4) | 0
        c[g >> 2] = u
        w = (q + -1) | 0
        if (!w) {
          G = 82
          break
        }
        q = w
        s = c[i >> 2] | 0
        t = u
      }
      if ((G | 0) == 11) {
        t = I(8) | 0
        Ch(t, 4471)
        c[t >> 2] = 3844
        K(t | 0, 2008, 119)
      } else if ((G | 0) == 82) {
        eb = d
        return
      }
    }
    t = (a + 12) | 0
    s = c[t >> 2] | 0
    q = (s - (c[a >> 2] | 0)) | 0
    E = (p - j) >> 2
    if (o >>> 0 <= (((q >> 2) - E) | 0) >>> 0) {
      b: do
        if ((s | 0) == (p | 0)) {
          N = o
          G = 27
        } else {
          j = o
          while (1) {
            c[e >> 2] = wh(4092) | 0
            be(a, e)
            M = (j + -1) | 0
            if (!M) break
            if ((c[t >> 2] | 0) == (c[g >> 2] | 0)) {
              N = M
              G = 27
              break b
            } else j = M
          }
          O = n
          P = c[b >> 2] | 0
        }
      while (0)
      if ((G | 0) == 27) {
        p = ~(l >>> 0 > m >>> 0 ? m : l)
        l = N
        do {
          c[e >> 2] = wh(4092) | 0
          ce(a, e)
          l = (l + -1) | 0
          Q =
            (((((c[g >> 2] | 0) - (c[i >> 2] | 0)) | 0) == 4 ? 92 : 93) +
              (c[b >> 2] | 0)) |
            0
          c[b >> 2] = Q
        } while ((l | 0) != 0)
        O = (N + -1 - p) | 0
        P = Q
      }
      c[b >> 2] = P + (r(O, -93) | 0)
      if (!O) {
        eb = d
        return
      }
      P = O
      O = c[g >> 2] | 0
      c: while (1) {
        Q = c[i >> 2] | 0
        p = c[Q >> 2] | 0
        N = (Q + 4) | 0
        c[i >> 2] = N
        Q = c[t >> 2] | 0
        l = Q
        do
          if ((O | 0) == (Q | 0)) {
            m = N
            s = c[a >> 2] | 0
            j = s
            if (N >>> 0 > s >>> 0) {
              h = (((((m - j) >> 2) + 1) | 0) / -2) | 0
              M = (N + (h << 2)) | 0
              L = (l - m) | 0
              if (!L) R = M
              else {
                Ui(M | 0, N | 0, L | 0) | 0
                R = ((c[i >> 2] | 0) + (h << 2)) | 0
              }
              h = (M + ((L >> 2) << 2)) | 0
              c[g >> 2] = h
              c[i >> 2] = R
              S = h
              break
            }
            h = (l - j) | 0
            j = (h | 0) == 0 ? 1 : h >> 1
            h = j >>> 2
            if (!j) T = 0
            else {
              if (j >>> 0 > 1073741823) {
                G = 39
                break c
              }
              T = wh(j << 2) | 0
            }
            L = T
            M = (T + (h << 2)) | 0
            k = M
            F = (T + (j << 2)) | 0
            if ((N | 0) == (O | 0)) {
              U = k
              V = s
            } else {
              s = ((((O + -4 - m) | 0) >>> 2) + 1) | 0
              m = M
              M = N
              while (1) {
                c[m >> 2] = c[M >> 2]
                M = (M + 4) | 0
                if ((M | 0) == (O | 0)) break
                else m = (m + 4) | 0
              }
              U = (T + ((s + h) << 2)) | 0
              V = c[a >> 2] | 0
            }
            c[a >> 2] = L
            c[i >> 2] = k
            c[g >> 2] = U
            c[t >> 2] = F
            if (!V) S = U
            else {
              yh(V)
              S = c[g >> 2] | 0
            }
          } else S = O
        while (0)
        c[S >> 2] = p
        O = ((c[g >> 2] | 0) + 4) | 0
        c[g >> 2] = O
        P = (P + -1) | 0
        if (!P) {
          G = 82
          break
        }
      }
      if ((G | 0) == 39) {
        P = I(8) | 0
        Ch(P, 4471)
        c[P >> 2] = 3844
        K(P | 0, 2008, 119)
      } else if ((G | 0) == 82) {
        eb = d
        return
      }
    }
    G = q >> 1
    q = (E + o) | 0
    P = G >>> 0 < q >>> 0 ? q : G
    G = (E - n) | 0
    E = (e + 12) | 0
    c[E >> 2] = 0
    c[(e + 16) >> 2] = a + 12
    do
      if (P)
        if (P >>> 0 > 1073741823) {
          q = I(8) | 0
          Ch(q, 4471)
          c[q >> 2] = 3844
          K(q | 0, 2008, 119)
        } else {
          W = wh(P << 2) | 0
          break
        }
      else W = 0
    while (0)
    c[e >> 2] = W
    q = (W + (G << 2)) | 0
    G = (e + 8) | 0
    c[G >> 2] = q
    O = (e + 4) | 0
    c[O >> 2] = q
    c[E >> 2] = W + (P << 2)
    P = o
    do {
      c[f >> 2] = wh(4092) | 0
      de(e, f)
      P = (P + -1) | 0
    } while ((P | 0) != 0)
    d: do
      if (!n) X = c[i >> 2] | 0
      else {
        P = n
        f = c[G >> 2] | 0
        o = c[i >> 2] | 0
        e: while (1) {
          W = c[E >> 2] | 0
          q = W
          do
            if ((f | 0) == (W | 0)) {
              S = c[O >> 2] | 0
              V = S
              U = c[e >> 2] | 0
              T = U
              if (S >>> 0 > U >>> 0) {
                R = (((((V - T) >> 2) + 1) | 0) / -2) | 0
                N = (S + (R << 2)) | 0
                l = (q - V) | 0
                if (!l) Y = N
                else {
                  Ui(N | 0, S | 0, l | 0) | 0
                  Y = ((c[O >> 2] | 0) + (R << 2)) | 0
                }
                R = (N + ((l >> 2) << 2)) | 0
                c[G >> 2] = R
                c[O >> 2] = Y
                Z = R
                break
              }
              R = (q - T) | 0
              T = (R | 0) == 0 ? 1 : R >> 1
              R = T >>> 2
              if (!T) _ = 0
              else {
                if (T >>> 0 > 1073741823) break e
                _ = wh(T << 2) | 0
              }
              l = _
              N = (_ + (R << 2)) | 0
              Q = N
              m = (_ + (T << 2)) | 0
              if ((S | 0) == (f | 0)) $ = Q
              else {
                T = ((((f + -4 - V) | 0) >>> 2) + 1) | 0
                V = N
                N = S
                while (1) {
                  c[V >> 2] = c[N >> 2]
                  N = (N + 4) | 0
                  if ((N | 0) == (f | 0)) break
                  else V = (V + 4) | 0
                }
                $ = (_ + ((T + R) << 2)) | 0
              }
              c[e >> 2] = l
              c[O >> 2] = Q
              c[G >> 2] = $
              c[E >> 2] = m
              if (!U) Z = $
              else {
                yh(U)
                Z = c[G >> 2] | 0
              }
            } else Z = f
          while (0)
          c[Z >> 2] = c[o >> 2]
          f = ((c[G >> 2] | 0) + 4) | 0
          c[G >> 2] = f
          q = ((c[i >> 2] | 0) + 4) | 0
          c[i >> 2] = q
          P = (P + -1) | 0
          if (!P) {
            X = q
            break d
          } else o = q
        }
        o = I(8) | 0
        Ch(o, 4471)
        c[o >> 2] = 3844
        K(o | 0, 2008, 119)
      }
    while (0)
    Z = c[g >> 2] | 0
    if ((Z | 0) == (X | 0)) {
      aa = X
      ba = Z
    } else {
      X = Z
      do {
        X = (X + -4) | 0
        ee(e, X)
        ca = c[i >> 2] | 0
      } while ((X | 0) != (ca | 0))
      aa = ca
      ba = c[g >> 2] | 0
    }
    ca = aa
    X = c[a >> 2] | 0
    c[a >> 2] = c[e >> 2]
    c[e >> 2] = X
    c[i >> 2] = c[O >> 2]
    c[O >> 2] = ca
    c[g >> 2] = c[G >> 2]
    c[G >> 2] = ba
    g = c[t >> 2] | 0
    c[t >> 2] = c[E >> 2]
    c[E >> 2] = g
    c[b >> 2] = (c[b >> 2] | 0) + (r(n, -93) | 0)
    n = ba
    if ((aa | 0) != (n | 0)) c[G >> 2] = n + (~(((n + -4 - ca) | 0) >>> 2) << 2)
    if (X | 0) yh(X)
    eb = d
    return
  }
  function be(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0
    d = (a + 8) | 0
    e = c[d >> 2] | 0
    f = (a + 12) | 0
    g = c[f >> 2] | 0
    h = g
    do
      if ((e | 0) == (g | 0)) {
        i = (a + 4) | 0
        j = c[i >> 2] | 0
        k = j
        l = c[a >> 2] | 0
        m = l
        if (j >>> 0 > l >>> 0) {
          n = (((((k - m) >> 2) + 1) | 0) / -2) | 0
          o = (j + (n << 2)) | 0
          p = (e - k) | 0
          if (!p) q = o
          else {
            Ui(o | 0, j | 0, p | 0) | 0
            q = ((c[i >> 2] | 0) + (n << 2)) | 0
          }
          n = (o + ((p >> 2) << 2)) | 0
          c[d >> 2] = n
          c[i >> 2] = q
          r = n
          break
        }
        n = (h - m) | 0
        m = (n | 0) == 0 ? 1 : n >> 1
        n = m >>> 2
        do
          if (m)
            if (m >>> 0 > 1073741823) {
              p = I(8) | 0
              Ch(p, 4471)
              c[p >> 2] = 3844
              K(p | 0, 2008, 119)
            } else {
              s = wh(m << 2) | 0
              break
            }
          else s = 0
        while (0)
        p = s
        o = (s + (n << 2)) | 0
        t = o
        u = (s + (m << 2)) | 0
        if ((j | 0) == (e | 0)) {
          v = t
          w = l
        } else {
          x = (n + (((e + -4 - k) | 0) >>> 2) + 1) | 0
          y = o
          o = j
          while (1) {
            c[y >> 2] = c[o >> 2]
            o = (o + 4) | 0
            if ((o | 0) == (e | 0)) break
            else y = (y + 4) | 0
          }
          v = (s + (x << 2)) | 0
          w = c[a >> 2] | 0
        }
        c[a >> 2] = p
        c[i >> 2] = t
        c[d >> 2] = v
        c[f >> 2] = u
        if (!w) r = v
        else {
          yh(w)
          r = c[d >> 2] | 0
        }
      } else r = e
    while (0)
    c[r >> 2] = c[b >> 2]
    c[d >> 2] = (c[d >> 2] | 0) + 4
    return
  }
  function ce(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0
    d = (a + 4) | 0
    e = c[d >> 2] | 0
    f = e
    g = c[a >> 2] | 0
    h = g
    do
      if ((e | 0) == (g | 0)) {
        i = (a + 8) | 0
        j = c[i >> 2] | 0
        k = (a + 12) | 0
        l = c[k >> 2] | 0
        m = l
        if (j >>> 0 < l >>> 0) {
          l = j
          n = (((((m - l) >> 2) + 1) | 0) / 2) | 0
          o = (j + (n << 2)) | 0
          p = (l - f) | 0
          l = (o + ((0 - (p >> 2)) << 2)) | 0
          if (!p) {
            q = o
            r = o
          } else {
            Ui(l | 0, e | 0, p | 0) | 0
            q = l
            r = ((c[i >> 2] | 0) + (n << 2)) | 0
          }
          c[d >> 2] = q
          c[i >> 2] = r
          s = q
          break
        }
        n = (m - h) | 0
        m = (n | 0) == 0 ? 1 : n >> 1
        n = ((m + 3) | 0) >>> 2
        do
          if (m)
            if (m >>> 0 > 1073741823) {
              l = I(8) | 0
              Ch(l, 4471)
              c[l >> 2] = 3844
              K(l | 0, 2008, 119)
            } else {
              t = wh(m << 2) | 0
              break
            }
          else t = 0
        while (0)
        l = t
        p = (t + (n << 2)) | 0
        o = p
        u = (t + (m << 2)) | 0
        if ((e | 0) == (j | 0)) {
          v = o
          w = e
        } else {
          x = ((((j + -4 - f) | 0) >>> 2) + n + 1) | 0
          y = p
          z = e
          while (1) {
            c[y >> 2] = c[z >> 2]
            z = (z + 4) | 0
            if ((z | 0) == (j | 0)) break
            else y = (y + 4) | 0
          }
          v = (t + (x << 2)) | 0
          w = c[a >> 2] | 0
        }
        c[a >> 2] = l
        c[d >> 2] = o
        c[i >> 2] = v
        c[k >> 2] = u
        if (!w) s = p
        else {
          yh(w)
          s = c[d >> 2] | 0
        }
      } else s = e
    while (0)
    c[(s + -4) >> 2] = c[b >> 2]
    c[d >> 2] = (c[d >> 2] | 0) + -4
    return
  }
  function de(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0
    d = (a + 8) | 0
    e = c[d >> 2] | 0
    f = (a + 12) | 0
    g = c[f >> 2] | 0
    h = g
    do
      if ((e | 0) == (g | 0)) {
        i = (a + 4) | 0
        j = c[i >> 2] | 0
        k = j
        l = c[a >> 2] | 0
        m = l
        if (j >>> 0 > l >>> 0) {
          n = (((((k - m) >> 2) + 1) | 0) / -2) | 0
          o = (j + (n << 2)) | 0
          p = (e - k) | 0
          if (!p) q = o
          else {
            Ui(o | 0, j | 0, p | 0) | 0
            q = ((c[i >> 2] | 0) + (n << 2)) | 0
          }
          n = (o + ((p >> 2) << 2)) | 0
          c[d >> 2] = n
          c[i >> 2] = q
          r = n
          break
        }
        n = (h - m) | 0
        m = (n | 0) == 0 ? 1 : n >> 1
        n = m >>> 2
        do
          if (m)
            if (m >>> 0 > 1073741823) {
              p = I(8) | 0
              Ch(p, 4471)
              c[p >> 2] = 3844
              K(p | 0, 2008, 119)
            } else {
              s = wh(m << 2) | 0
              break
            }
          else s = 0
        while (0)
        p = s
        o = (s + (n << 2)) | 0
        t = o
        u = (s + (m << 2)) | 0
        if ((j | 0) == (e | 0)) {
          v = t
          w = l
        } else {
          x = (n + (((e + -4 - k) | 0) >>> 2) + 1) | 0
          y = o
          o = j
          while (1) {
            c[y >> 2] = c[o >> 2]
            o = (o + 4) | 0
            if ((o | 0) == (e | 0)) break
            else y = (y + 4) | 0
          }
          v = (s + (x << 2)) | 0
          w = c[a >> 2] | 0
        }
        c[a >> 2] = p
        c[i >> 2] = t
        c[d >> 2] = v
        c[f >> 2] = u
        if (!w) r = v
        else {
          yh(w)
          r = c[d >> 2] | 0
        }
      } else r = e
    while (0)
    c[r >> 2] = c[b >> 2]
    c[d >> 2] = (c[d >> 2] | 0) + 4
    return
  }
  function ee(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0
    d = (a + 4) | 0
    e = c[d >> 2] | 0
    f = e
    g = c[a >> 2] | 0
    h = g
    do
      if ((e | 0) == (g | 0)) {
        i = (a + 8) | 0
        j = c[i >> 2] | 0
        k = (a + 12) | 0
        l = c[k >> 2] | 0
        m = l
        if (j >>> 0 < l >>> 0) {
          l = j
          n = (((((m - l) >> 2) + 1) | 0) / 2) | 0
          o = (j + (n << 2)) | 0
          p = (l - f) | 0
          l = (o + ((0 - (p >> 2)) << 2)) | 0
          if (!p) {
            q = o
            r = o
          } else {
            Ui(l | 0, e | 0, p | 0) | 0
            q = l
            r = ((c[i >> 2] | 0) + (n << 2)) | 0
          }
          c[d >> 2] = q
          c[i >> 2] = r
          s = q
          break
        }
        n = (m - h) | 0
        m = (n | 0) == 0 ? 1 : n >> 1
        n = ((m + 3) | 0) >>> 2
        do
          if (m)
            if (m >>> 0 > 1073741823) {
              l = I(8) | 0
              Ch(l, 4471)
              c[l >> 2] = 3844
              K(l | 0, 2008, 119)
            } else {
              t = wh(m << 2) | 0
              break
            }
          else t = 0
        while (0)
        l = t
        p = (t + (n << 2)) | 0
        o = p
        u = (t + (m << 2)) | 0
        if ((e | 0) == (j | 0)) {
          v = o
          w = e
        } else {
          x = ((((j + -4 - f) | 0) >>> 2) + n + 1) | 0
          y = p
          z = e
          while (1) {
            c[y >> 2] = c[z >> 2]
            z = (z + 4) | 0
            if ((z | 0) == (j | 0)) break
            else y = (y + 4) | 0
          }
          v = (t + (x << 2)) | 0
          w = c[a >> 2] | 0
        }
        c[a >> 2] = l
        c[d >> 2] = o
        c[i >> 2] = v
        c[k >> 2] = u
        if (!w) s = p
        else {
          yh(w)
          s = c[d >> 2] | 0
        }
      } else s = e
    while (0)
    c[(s + -4) >> 2] = c[b >> 2]
    c[d >> 2] = (c[d >> 2] | 0) + -4
    return
  }
  function fe(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0
    b = (a + 4) | 0
    d = c[b >> 2] | 0
    e = (a + 16) | 0
    f = c[e >> 2] | 0
    g = ((f >>> 0) / 93) | 0
    h = (d + (g << 2)) | 0
    i = (a + 8) | 0
    j = c[i >> 2] | 0
    k = j
    l = d
    if ((j | 0) != (d | 0)) {
      j = ((c[h >> 2] | 0) + ((((f - ((g * 93) | 0)) | 0) * 44) | 0)) | 0
      g = (a + 20) | 0
      m = ((c[g >> 2] | 0) + f) | 0
      f = ((m >>> 0) / 93) | 0
      n =
        ((c[(d + (f << 2)) >> 2] | 0) +
          ((((m - ((f * 93) | 0)) | 0) * 44) | 0)) |
        0
      if ((n | 0) == (j | 0)) {
        o = g
        p = 5
      } else {
        f = h
        h = j
        while (1) {
          j = c[(h + 8) >> 2] | 0
          if (j | 0) gh(c[(j + -4) >> 2] | 0)
          j = c[(h + 12) >> 2] | 0
          if (j | 0) gh(c[(j + -4) >> 2] | 0)
          j = c[(h + 16) >> 2] | 0
          if (j | 0) gh(c[(j + -4) >> 2] | 0)
          j = (h + 44) | 0
          if (((j - (c[f >> 2] | 0)) | 0) == 4092) {
            m = (f + 4) | 0
            q = m
            r = c[m >> 2] | 0
          } else {
            q = f
            r = j
          }
          h = r
          if ((n | 0) == (h | 0)) break
          else f = q
        }
        q = c[b >> 2] | 0
        s = i
        t = g
        u = q
        v = c[i >> 2] | 0
        w = q
      }
    } else {
      o = (a + 20) | 0
      p = 5
    }
    if ((p | 0) == 5) {
      s = i
      t = o
      u = l
      v = k
      w = d
    }
    c[t >> 2] = 0
    t = (v - u) >> 2
    if (t >>> 0 > 2) {
      u = w
      do {
        yh(c[u >> 2] | 0)
        u = ((c[b >> 2] | 0) + 4) | 0
        c[b >> 2] = u
        w = ((c[s >> 2] | 0) - u) >> 2
      } while (w >>> 0 > 2)
      x = w
    } else x = t
    switch (x | 0) {
      case 1: {
        y = 46
        break
      }
      case 2: {
        y = 93
        break
      }
      default:
        return
    }
    c[e >> 2] = y
    return
  }
  function ge(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function he(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function ie(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 8995 ? (a + 12) | 0 : 0) | 0
  }
  function je(a) {
    a = a | 0
    yh(a)
    return
  }
  function ke(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0
    e = c[(b + 8) >> 2] | 0
    f = c[(b + 4) >> 2] | 0
    b = vd(e, f, d) | 0
    d = (e + 4784) | 0
    if (!(a[d >> 0] | 0)) return b | 0
    wc(f)
    a[d >> 0] = 0
    return b | 0
  }
  function le(a) {
    a = a | 0
    var b = 0
    c[a >> 2] = 2792
    b = (a + 8) | 0
    a = c[b >> 2] | 0
    c[b >> 2] = 0
    if (!a) return
    yc((a + 4700) | 0)
    yc((a + 4620) | 0)
    yc((a + 4540) | 0)
    yc((a + 4460) | 0)
    yc((a + 4380) | 0)
    ud((a + 4300) | 0)
    ud((a + 4220) | 0)
    ud((a + 4140) | 0)
    ud((a + 4060) | 0)
    ud((a + 3980) | 0)
    td(a)
    yh(a)
    return
  }
  function me(a) {
    a = a | 0
    le(a)
    yh(a)
    return
  }
  function ne(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function oe(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function pe(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
    return
  }
  function qe(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 9737 ? (a + 12) | 0 : 0) | 0
  }
  function re(a) {
    a = a | 0
    yh(a)
    return
  }
  function se(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0
    e = c[(b + 8) >> 2] | 0
    f = c[(b + 4) >> 2] | 0
    b = Hd((e + 4784) | 0, f, vd(e, f, d) | 0) | 0
    d = (e + 5112) | 0
    if (!(a[d >> 0] | 0)) return b | 0
    wc(f)
    a[d >> 0] = 0
    return b | 0
  }
  function te(a) {
    a = a | 0
    var b = 0
    c[a >> 2] = 2840
    b = (a + 8) | 0
    a = c[b >> 2] | 0
    c[b >> 2] = 0
    if (!a) return
    yc((a + 5028) | 0)
    ud((a + 4948) | 0)
    Gd((a + 4784) | 0)
    yc((a + 4700) | 0)
    yc((a + 4620) | 0)
    yc((a + 4540) | 0)
    yc((a + 4460) | 0)
    yc((a + 4380) | 0)
    ud((a + 4300) | 0)
    ud((a + 4220) | 0)
    ud((a + 4140) | 0)
    ud((a + 4060) | 0)
    ud((a + 3980) | 0)
    td(a)
    yh(a)
    return
  }
  function ue(a) {
    a = a | 0
    te(a)
    yh(a)
    return
  }
  function ve(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function we(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
    return
  }
  function xe(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 10560 ? (a + 12) | 0 : 0) | 0
  }
  function ye(a) {
    a = a | 0
    yh(a)
    return
  }
  function ze(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0
    e = c[(b + 8) >> 2] | 0
    f = c[(b + 4) >> 2] | 0
    b = Rd((e + 4784) | 0, f, vd(e, f, d) | 0) | 0
    d = (e + 5100) | 0
    if (!(a[d >> 0] | 0)) return b | 0
    wc(f)
    a[d >> 0] = 0
    return b | 0
  }
  function Ae(a) {
    a = a | 0
    var b = 0
    c[a >> 2] = 2888
    b = (a + 8) | 0
    a = c[b >> 2] | 0
    c[b >> 2] = 0
    if (!a) return
    Qd((a + 4784) | 0)
    yc((a + 4700) | 0)
    yc((a + 4620) | 0)
    yc((a + 4540) | 0)
    yc((a + 4460) | 0)
    yc((a + 4380) | 0)
    ud((a + 4300) | 0)
    ud((a + 4220) | 0)
    ud((a + 4140) | 0)
    ud((a + 4060) | 0)
    ud((a + 3980) | 0)
    td(a)
    yh(a)
    return
  }
  function Be(a) {
    a = a | 0
    Ae(a)
    yh(a)
    return
  }
  function Ce(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function De(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
    return
  }
  function Ee(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 11405 ? (a + 12) | 0 : 0) | 0
  }
  function Fe(a) {
    a = a | 0
    yh(a)
    return
  }
  function Ge(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0
    e = c[(b + 8) >> 2] | 0
    f = c[(b + 4) >> 2] | 0
    b = Rd((e + 5112) | 0, f, Hd((e + 4784) | 0, f, vd(e, f, d) | 0) | 0) | 0
    d = (e + 5428) | 0
    if (!(a[d >> 0] | 0)) return b | 0
    wc(f)
    a[d >> 0] = 0
    return b | 0
  }
  function He(a) {
    a = a | 0
    var b = 0
    c[a >> 2] = 2936
    b = (a + 8) | 0
    a = c[b >> 2] | 0
    c[b >> 2] = 0
    if (!a) return
    Qd((a + 5112) | 0)
    yc((a + 5028) | 0)
    ud((a + 4948) | 0)
    Gd((a + 4784) | 0)
    yc((a + 4700) | 0)
    yc((a + 4620) | 0)
    yc((a + 4540) | 0)
    yc((a + 4460) | 0)
    yc((a + 4380) | 0)
    ud((a + 4300) | 0)
    ud((a + 4220) | 0)
    ud((a + 4140) | 0)
    ud((a + 4060) | 0)
    ud((a + 3980) | 0)
    td(a)
    yh(a)
    return
  }
  function Ie(a) {
    a = a | 0
    He(a)
    yh(a)
    return
  }
  function Je(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Ke(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
    return
  }
  function Le(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 12306 ? (a + 12) | 0 : 0) | 0
  }
  function Me(a) {
    a = a | 0
    yh(a)
    return
  }
  function Ne(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function Oe(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Pe(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    yh(b)
    return
  }
  function Qe(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 12699 ? (a + 12) | 0 : 0) | 0
  }
  function Re(a) {
    a = a | 0
    yh(a)
    return
  }
  function Se(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function Te(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Ue(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    yh(b)
    return
  }
  function Ve(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 12860 ? (a + 12) | 0 : 0) | 0
  }
  function We(a) {
    a = a | 0
    yh(a)
    return
  }
  function Xe(b, e) {
    b = b | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0
    f = c[(b + 8) >> 2] | 0
    g = c[(b + 12) >> 2] | 0
    if ((f | 0) == (g | 0)) h = e
    else {
      i = e
      e = f
      while (1) {
        f = c[e >> 2] | 0
        j = c[(e + 4) >> 2] | 0
        k = (j | 0) == 0
        if (!k) {
          l = (j + 4) | 0
          c[l >> 2] = (c[l >> 2] | 0) + 1
        }
        l = kb[c[((c[f >> 2] | 0) + 12) >> 2] & 63](f, i) | 0
        if (
          !k
            ? ((k = (j + 4) | 0),
              (f = c[k >> 2] | 0),
              (c[k >> 2] = f + -1),
              (f | 0) == 0)
            : 0
        ) {
          ob[c[((c[j >> 2] | 0) + 8) >> 2] & 255](j)
          th(j)
        }
        e = (e + 8) | 0
        if ((e | 0) == (g | 0)) {
          h = l
          break
        } else i = l
      }
    }
    i = (b + 20) | 0
    if (!(a[i >> 0] | 0)) return h | 0
    a[i >> 0] = 0
    i = c[(b + 4) >> 2] | 0
    b = c[i >> 2] | 0
    g = c[b >> 2] | 0
    e = (b + 8) | 0
    b = c[e >> 2] | 0
    l = (b + 1) | 0
    c[e >> 2] = l
    j = d[(g + b) >> 0] << 24
    f = (b + 2) | 0
    c[e >> 2] = f
    k = (d[(g + l) >> 0] << 16) | j
    j = (b + 3) | 0
    c[e >> 2] = j
    l = k | (d[(g + f) >> 0] << 8)
    c[e >> 2] = b + 4
    c[(i + 4) >> 2] = l | d[(g + j) >> 0]
    return h | 0
  }
  function Ye(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    c[a >> 2] = 3040
    b = (a + 8) | 0
    d = c[b >> 2] | 0
    if (!d) return
    e = (a + 12) | 0
    a = c[e >> 2] | 0
    if ((a | 0) == (d | 0)) f = d
    else {
      g = a
      do {
        a = c[(g + -4) >> 2] | 0
        g = (g + -8) | 0
        if (
          a | 0
            ? ((h = (a + 4) | 0),
              (i = c[h >> 2] | 0),
              (c[h >> 2] = i + -1),
              (i | 0) == 0)
            : 0
        ) {
          ob[c[((c[a >> 2] | 0) + 8) >> 2] & 255](a)
          th(a)
        }
      } while ((g | 0) != (d | 0))
      f = c[b >> 2] | 0
    }
    c[e >> 2] = d
    yh(f)
    return
  }
  function Ze(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    c[a >> 2] = 3040
    b = (a + 8) | 0
    d = c[b >> 2] | 0
    if (!d) {
      yh(a)
      return
    }
    e = (a + 12) | 0
    f = c[e >> 2] | 0
    if ((f | 0) == (d | 0)) g = d
    else {
      h = f
      do {
        f = c[(h + -4) >> 2] | 0
        h = (h + -8) | 0
        if (
          f | 0
            ? ((i = (f + 4) | 0),
              (j = c[i >> 2] | 0),
              (c[i >> 2] = j + -1),
              (j | 0) == 0)
            : 0
        ) {
          ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
          th(f)
        }
      } while ((h | 0) != (d | 0))
      g = c[b >> 2] | 0
    }
    c[e >> 2] = d
    yh(g)
    yh(a)
    return
  }
  function _e(a, b) {
    a = a | 0
    b = b | 0
    return
  }
  function $e(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function af(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 8) >> 2] & 255](b)
    return
  }
  function bf(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 13183 ? (a + 12) | 0 : 0) | 0
  }
  function cf(a) {
    a = a | 0
    yh(a)
    return
  }
  function df(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    f = (d + 8) | 0
    g = wh(180) | 0
    h = c[(b + 4) >> 2] | 0
    c[g >> 2] = 3088
    c[(g + 4) >> 2] = h
    c[(g + 12) >> 2] = 32
    c[(g + 16) >> 2] = 1
    c[(g + 20) >> 2] = 8
    c[(g + 24) >> 2] = 0
    c[(g + 44) >> 2] = 0
    c[(g + 48) >> 2] = 0
    c[(g + 52) >> 2] = 0
    c[(g + 68) >> 2] = 1
    c[(g + 72) >> 2] = 2
    c[(g + 64) >> 2] = 4096
    c[(g + 60) >> 2] = 4
    c[(g + 56) >> 2] = 4
    c[(g + 76) >> 2] = 0
    c[(g + 80) >> 2] = 0
    c[(g + 84) >> 2] = 0
    c[(g + 28) >> 2] = 32
    c[(g + 32) >> 2] = 0
    c[(g + 36) >> 2] = -2147483648
    c[(g + 40) >> 2] = 2147483647
    c[(g + 8) >> 2] = 0
    c[(g + 92) >> 2] = 32
    c[(g + 96) >> 2] = 1
    c[(g + 100) >> 2] = 8
    c[(g + 104) >> 2] = 0
    c[(g + 124) >> 2] = 0
    c[(g + 128) >> 2] = 0
    c[(g + 132) >> 2] = 0
    c[(g + 148) >> 2] = 1
    c[(g + 152) >> 2] = 2
    c[(g + 144) >> 2] = 4096
    c[(g + 140) >> 2] = 4
    c[(g + 136) >> 2] = 4
    c[(g + 156) >> 2] = 0
    c[(g + 160) >> 2] = 0
    c[(g + 164) >> 2] = 0
    c[(g + 108) >> 2] = 32
    c[(g + 112) >> 2] = 0
    c[(g + 116) >> 2] = -2147483648
    c[(g + 120) >> 2] = 2147483647
    c[(g + 88) >> 2] = 0
    a[(g + 168) >> 0] = 0
    a[(g + 169) >> 0] = 0
    a[(g + 176) >> 0] = 0
    c[f >> 2] = g
    h = wh(16) | 0
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    c[h >> 2] = 3112
    c[(h + 12) >> 2] = g
    i = (f + 4) | 0
    c[i >> 2] = h
    c[e >> 2] = g
    c[(e + 4) >> 2] = g
    xd(f, e)
    e = (b + 12) | 0
    g = c[e >> 2] | 0
    if (g >>> 0 < (c[(b + 16) >> 2] | 0) >>> 0) {
      c[g >> 2] = c[f >> 2]
      c[(g + 4) >> 2] = c[i >> 2]
      c[f >> 2] = 0
      c[i >> 2] = 0
      c[e >> 2] = g + 8
      eb = d
      return
    }
    kd((b + 8) | 0, f)
    f = c[i >> 2] | 0
    if (!f) {
      eb = d
      return
    }
    i = (f + 4) | 0
    b = c[i >> 2] | 0
    c[i >> 2] = b + -1
    if (b | 0) {
      eb = d
      return
    }
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    eb = d
    return
  }
  function ef(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    f = (d + 8) | 0
    g = wh(180) | 0
    h = c[(b + 4) >> 2] | 0
    c[g >> 2] = 3140
    c[(g + 4) >> 2] = h
    c[(g + 12) >> 2] = 32
    c[(g + 16) >> 2] = 1
    c[(g + 20) >> 2] = 8
    c[(g + 24) >> 2] = 0
    c[(g + 44) >> 2] = 0
    c[(g + 48) >> 2] = 0
    c[(g + 52) >> 2] = 0
    c[(g + 68) >> 2] = 1
    c[(g + 72) >> 2] = 2
    c[(g + 64) >> 2] = 4096
    c[(g + 60) >> 2] = 4
    c[(g + 56) >> 2] = 4
    c[(g + 76) >> 2] = 0
    c[(g + 80) >> 2] = 0
    c[(g + 84) >> 2] = 0
    c[(g + 28) >> 2] = 32
    c[(g + 32) >> 2] = 0
    c[(g + 36) >> 2] = -2147483648
    c[(g + 40) >> 2] = 2147483647
    c[(g + 8) >> 2] = 0
    c[(g + 92) >> 2] = 32
    c[(g + 96) >> 2] = 1
    c[(g + 100) >> 2] = 8
    c[(g + 104) >> 2] = 0
    c[(g + 124) >> 2] = 0
    c[(g + 128) >> 2] = 0
    c[(g + 132) >> 2] = 0
    c[(g + 148) >> 2] = 1
    c[(g + 152) >> 2] = 2
    c[(g + 144) >> 2] = 4096
    c[(g + 140) >> 2] = 4
    c[(g + 136) >> 2] = 4
    c[(g + 156) >> 2] = 0
    c[(g + 160) >> 2] = 0
    c[(g + 164) >> 2] = 0
    c[(g + 108) >> 2] = 32
    c[(g + 112) >> 2] = 0
    c[(g + 116) >> 2] = -2147483648
    c[(g + 120) >> 2] = 2147483647
    c[(g + 88) >> 2] = 0
    a[(g + 168) >> 0] = 0
    a[(g + 169) >> 0] = 0
    a[(g + 176) >> 0] = 0
    c[f >> 2] = g
    h = wh(16) | 0
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    c[h >> 2] = 3164
    c[(h + 12) >> 2] = g
    i = (f + 4) | 0
    c[i >> 2] = h
    c[e >> 2] = g
    c[(e + 4) >> 2] = g
    xd(f, e)
    e = (b + 12) | 0
    g = c[e >> 2] | 0
    if (g >>> 0 < (c[(b + 16) >> 2] | 0) >>> 0) {
      c[g >> 2] = c[f >> 2]
      c[(g + 4) >> 2] = c[i >> 2]
      c[f >> 2] = 0
      c[i >> 2] = 0
      c[e >> 2] = g + 8
      eb = d
      return
    }
    kd((b + 8) | 0, f)
    f = c[i >> 2] | 0
    if (!f) {
      eb = d
      return
    }
    i = (f + 4) | 0
    b = c[i >> 2] | 0
    c[i >> 2] = b + -1
    if (b | 0) {
      eb = d
      return
    }
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    eb = d
    return
  }
  function ff(a) {
    a = a | 0
    c[a >> 2] = 3088
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    return
  }
  function gf(a) {
    a = a | 0
    c[a >> 2] = 3088
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    yh(a)
    return
  }
  function hf(a, b) {
    a = a | 0
    b = b | 0
    return jf((a + 8) | 0, c[(a + 4) >> 2] | 0, b) | 0
  }
  function jf(b, e, f) {
    b = b | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0
    if (!(a[(b + 161) >> 0] | 0)) xc((b + 80) | 0)
    g = (b + 164) | 0
    h = (b + 168) | 0
    if (!(a[h >> 0] | 0)) {
      i = c[e >> 2] | 0
      j = (i + 8) | 0
      k = c[i >> 2] | 0
      l = c[j >> 2] | 0
      c[j >> 2] = l + 1
      a[f >> 0] = a[(k + l) >> 0] | 0
      l = c[i >> 2] | 0
      k = c[j >> 2] | 0
      c[j >> 2] = k + 1
      m = (f + 1) | 0
      a[m >> 0] = a[(l + k) >> 0] | 0
      k = c[i >> 2] | 0
      l = c[j >> 2] | 0
      c[j >> 2] = l + 1
      n = (f + 2) | 0
      a[n >> 0] = a[(k + l) >> 0] | 0
      l = c[i >> 2] | 0
      i = c[j >> 2] | 0
      c[j >> 2] = i + 1
      j = a[(l + i) >> 0] | 0
      a[(f + 3) >> 0] = j
      o = (d[m >> 0] << 8) | d[f >> 0] | (d[n >> 0] << 16) | ((j & 255) << 24)
    } else {
      j = c[g >> 2] | 0
      n = ((kf((b + 80) | 0, e, c[(b + 116) >> 2] | 0) | 0) + j) | 0
      j = c[(b + 104) >> 2] | 0
      if ((n | 0) < 0) p = (n + j) | 0
      else p = (n - (n >>> 0 < j >>> 0 ? 0 : j)) | 0
      a[(f + 3) >> 0] = p >>> 24
      a[(f + 2) >> 0] = p >>> 16
      a[(f + 1) >> 0] = p >>> 8
      a[f >> 0] = p
      o = p
    }
    p = (f + 4) | 0
    if (a[h >> 0] | 0) {
      c[g >> 2] = o
      return p | 0
    }
    a[h >> 0] = 1
    c[g >> 2] = o
    return p | 0
  }
  function kf(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0
    e = lf(b, d) | 0
    c[a >> 2] = e
    if (!e) {
      f = nf(b, (a + 48) | 0) | 0
      return f | 0
    }
    if (e >>> 0 >= 32) {
      f = c[(a + 28) >> 2] | 0
      return f | 0
    }
    d = c[(a + 12) >> 2] | 0
    if (e >>> 0 > d >>> 0) {
      g = (e - d) | 0
      d = lf(b, ((c[(a + 68) >> 2] | 0) + ((((e + -1) | 0) * 44) | 0)) | 0) | 0
      h = (d << g) | (mf(b, g) | 0)
    } else
      h = lf(b, ((c[(a + 68) >> 2] | 0) + ((((e + -1) | 0) * 44) | 0)) | 0) | 0
    e = c[a >> 2] | 0
    if ((h | 0) < ((1 << (e + -1)) | 0)) {
      f = (h + 1 + (-1 << e)) | 0
      return f | 0
    } else {
      f = (h + 1) | 0
      return f | 0
    }
    return 0
  }
  function lf(a, b) {
    a = a | 0
    b = b | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0
    e = (a + 8) | 0
    f = c[e >> 2] | 0
    g = c[(b + 16) >> 2] | 0
    if (g) {
      h = (a + 4) | 0
      i = c[h >> 2] | 0
      j = f >>> 15
      c[e >> 2] = j
      k = ((i >>> 0) / (j >>> 0)) | 0
      l = k >>> (c[(b + 40) >> 2] | 0)
      m = c[(g + (l << 2)) >> 2] | 0
      n = ((c[(g + ((l + 1) << 2)) >> 2] | 0) + 1) | 0
      l = (m + 1) | 0
      g = c[(b + 8) >> 2] | 0
      if (n >>> 0 > l >>> 0) {
        o = m
        p = n
        while (1) {
          n = ((p + o) | 0) >>> 1
          q = (c[(g + (n << 2)) >> 2] | 0) >>> 0 > k >>> 0
          s = q ? o : n
          p = q ? n : p
          n = (s + 1) | 0
          if (p >>> 0 <= n >>> 0) {
            t = s
            u = n
            break
          } else o = s
        }
      } else {
        t = m
        u = l
      }
      l = r(c[(g + (t << 2)) >> 2] | 0, j) | 0
      if ((t | 0) == (c[(b + 32) >> 2] | 0)) {
        v = l
        w = f
        x = t
        y = h
        z = i
      } else {
        v = l
        w = r(c[(g + (u << 2)) >> 2] | 0, j) | 0
        x = t
        y = h
        z = i
      }
    } else {
      i = f >>> 15
      c[e >> 2] = i
      h = c[b >> 2] | 0
      t = c[(b + 8) >> 2] | 0
      j = (a + 4) | 0
      u = c[j >> 2] | 0
      g = h >>> 1
      l = 0
      m = f
      f = h
      h = 0
      while (1) {
        o = r(c[(t + (g << 2)) >> 2] | 0, i) | 0
        p = o >>> 0 > u >>> 0
        k = p ? o : m
        s = p ? l : o
        o = p ? h : g
        f = p ? g : f
        g = ((o + f) | 0) >>> 1
        if ((g | 0) == (o | 0)) {
          v = s
          w = k
          x = o
          y = j
          z = u
          break
        } else {
          l = s
          m = k
          h = o
        }
      }
    }
    h = (z - v) | 0
    c[y >> 2] = h
    z = (w - v) | 0
    c[e >> 2] = z
    if (z >>> 0 < 16777216) {
      v = c[a >> 2] | 0
      a = c[v >> 2] | 0
      w = (v + 8) | 0
      v = h
      h = c[w >> 2] | 0
      m = z
      do {
        z = h
        h = (h + 1) | 0
        c[w >> 2] = h
        v = (v << 8) | (d[(a + z) >> 0] | 0)
        c[y >> 2] = v
        m = m << 8
        c[e >> 2] = m
      } while (m >>> 0 < 16777216)
    }
    m = ((c[(b + 12) >> 2] | 0) + (x << 2)) | 0
    c[m >> 2] = (c[m >> 2] | 0) + 1
    m = (b + 28) | 0
    e = ((c[m >> 2] | 0) + -1) | 0
    c[m >> 2] = e
    if (e | 0) return x | 0
    Ic(b)
    return x | 0
  }
  function mf(a, b) {
    a = a | 0
    b = b | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0
    e = (a + 4) | 0
    f = c[e >> 2] | 0
    g = (a + 8) | 0
    h = c[g >> 2] | 0
    if (b >>> 0 > 19) {
      i = h >>> 16
      c[g >> 2] = i
      j = ((f >>> 0) / (i >>> 0)) | 0
      k = (f - (r(j, i) | 0)) | 0
      c[e >> 2] = k
      l = c[a >> 2] | 0
      m = c[l >> 2] | 0
      n = (l + 8) | 0
      l = k
      k = c[n >> 2] | 0
      o = i
      do {
        i = k
        k = (k + 1) | 0
        c[n >> 2] = k
        l = (l << 8) | (d[(m + i) >> 0] | 0)
        c[e >> 2] = l
        o = o << 8
        c[g >> 2] = o
      } while (o >>> 0 < 16777216)
      return ((mf(a, (b + -16) | 0) | 0) << 16) | (j & 65535) | 0
    }
    j = h >>> b
    c[g >> 2] = j
    b = ((f >>> 0) / (j >>> 0)) | 0
    h = (f - (r(b, j) | 0)) | 0
    c[e >> 2] = h
    if (j >>> 0 >= 16777216) return b | 0
    f = c[a >> 2] | 0
    a = c[f >> 2] | 0
    o = (f + 8) | 0
    f = h
    h = c[o >> 2] | 0
    l = j
    do {
      j = h
      h = (h + 1) | 0
      c[o >> 2] = h
      f = (f << 8) | (d[(a + j) >> 0] | 0)
      c[e >> 2] = f
      l = l << 8
      c[g >> 2] = l
    } while (l >>> 0 < 16777216)
    return b | 0
  }
  function nf(a, b) {
    a = a | 0
    b = b | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0
    e = (b + 8) | 0
    f = (a + 8) | 0
    g = c[f >> 2] | 0
    h = r(g >>> 13, c[e >> 2] | 0) | 0
    i = (a + 4) | 0
    j = c[i >> 2] | 0
    k = j >>> 0 >= h >>> 0
    l = k & 1
    if (k) {
      k = (j - h) | 0
      c[i >> 2] = k
      m = (g - h) | 0
      c[f >> 2] = m
      n = k
      o = m
    } else {
      c[f >> 2] = h
      m = (b + 12) | 0
      c[m >> 2] = (c[m >> 2] | 0) + 1
      n = j
      o = h
    }
    if (o >>> 0 < 16777216) {
      h = c[a >> 2] | 0
      a = c[h >> 2] | 0
      j = (h + 8) | 0
      h = n
      n = c[j >> 2] | 0
      m = o
      do {
        o = n
        n = (n + 1) | 0
        c[j >> 2] = n
        h = (h << 8) | (d[(a + o) >> 0] | 0)
        c[i >> 2] = h
        m = m << 8
        c[f >> 2] = m
      } while (m >>> 0 < 16777216)
    }
    m = (b + 4) | 0
    f = ((c[m >> 2] | 0) + -1) | 0
    c[m >> 2] = f
    if (f | 0) return l | 0
    f = c[b >> 2] | 0
    h = (b + 16) | 0
    i = ((c[h >> 2] | 0) + f) | 0
    c[h >> 2] = i
    if (i >>> 0 > 8192) {
      a = ((i + 1) | 0) >>> 1
      c[h >> 2] = a
      n = (b + 12) | 0
      j = (((c[n >> 2] | 0) + 1) | 0) >>> 1
      c[n >> 2] = j
      n = (a + 1) | 0
      if ((j | 0) == (a | 0)) {
        c[h >> 2] = n
        p = n
        q = a
      } else {
        p = a
        q = j
      }
    } else {
      p = i
      q = c[(b + 12) >> 2] | 0
    }
    c[e >> 2] = (r((2147483648 / (p >>> 0)) | 0, q) | 0) >>> 18
    q = (f * 5) | 0
    f = q >>> 0 > 259 ? 64 : q >>> 2
    c[b >> 2] = f
    c[m >> 2] = f
    return l | 0
  }
  function of(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function pf(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function qf(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 13637 ? (a + 12) | 0 : 0) | 0
  }
  function rf(a) {
    a = a | 0
    yh(a)
    return
  }
  function sf(a) {
    a = a | 0
    c[a >> 2] = 3140
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    return
  }
  function tf(a) {
    a = a | 0
    c[a >> 2] = 3140
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    yh(a)
    return
  }
  function uf(a, b) {
    a = a | 0
    b = b | 0
    return vf((a + 8) | 0, c[(a + 4) >> 2] | 0, b) | 0
  }
  function vf(b, e, f) {
    b = b | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0
    if (!(a[(b + 161) >> 0] | 0)) xc((b + 80) | 0)
    g = (b + 164) | 0
    h = (b + 168) | 0
    if (!(a[h >> 0] | 0)) {
      i = c[e >> 2] | 0
      j = (i + 8) | 0
      k = c[i >> 2] | 0
      l = c[j >> 2] | 0
      c[j >> 2] = l + 1
      a[f >> 0] = a[(k + l) >> 0] | 0
      l = c[i >> 2] | 0
      k = c[j >> 2] | 0
      c[j >> 2] = k + 1
      m = (f + 1) | 0
      a[m >> 0] = a[(l + k) >> 0] | 0
      k = c[i >> 2] | 0
      l = c[j >> 2] | 0
      c[j >> 2] = l + 1
      n = (f + 2) | 0
      a[n >> 0] = a[(k + l) >> 0] | 0
      l = c[i >> 2] | 0
      i = c[j >> 2] | 0
      c[j >> 2] = i + 1
      j = a[(l + i) >> 0] | 0
      a[(f + 3) >> 0] = j
      o = (d[m >> 0] << 8) | d[f >> 0] | (d[n >> 0] << 16) | ((j & 255) << 24)
    } else {
      j = c[g >> 2] | 0
      n = ((kf((b + 80) | 0, e, c[(b + 116) >> 2] | 0) | 0) + j) | 0
      j = c[(b + 104) >> 2] | 0
      if ((n | 0) < 0) p = (n + j) | 0
      else p = (n - (n >>> 0 < j >>> 0 ? 0 : j)) | 0
      a[(f + 3) >> 0] = p >>> 24
      a[(f + 2) >> 0] = p >>> 16
      a[(f + 1) >> 0] = p >>> 8
      a[f >> 0] = p
      o = p
    }
    p = (f + 4) | 0
    if (a[h >> 0] | 0) {
      c[g >> 2] = o
      return p | 0
    }
    a[h >> 0] = 1
    c[g >> 2] = o
    return p | 0
  }
  function wf(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function xf(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function yf(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 14135 ? (a + 12) | 0 : 0) | 0
  }
  function zf(a) {
    a = a | 0
    yh(a)
    return
  }
  function Af(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    f = (d + 8) | 0
    g = wh(172) | 0
    h = c[(b + 4) >> 2] | 0
    c[g >> 2] = 3192
    c[(g + 4) >> 2] = h
    c[(g + 12) >> 2] = 8
    c[(g + 16) >> 2] = 1
    c[(g + 20) >> 2] = 8
    c[(g + 24) >> 2] = 0
    c[(g + 44) >> 2] = 0
    c[(g + 48) >> 2] = 0
    c[(g + 52) >> 2] = 0
    c[(g + 68) >> 2] = 1
    c[(g + 72) >> 2] = 2
    c[(g + 64) >> 2] = 4096
    c[(g + 60) >> 2] = 4
    c[(g + 56) >> 2] = 4
    c[(g + 76) >> 2] = 0
    c[(g + 80) >> 2] = 0
    c[(g + 84) >> 2] = 0
    c[(g + 28) >> 2] = 8
    c[(g + 32) >> 2] = 256
    c[(g + 36) >> 2] = -128
    c[(g + 40) >> 2] = 127
    c[(g + 8) >> 2] = 0
    c[(g + 92) >> 2] = 8
    c[(g + 96) >> 2] = 1
    c[(g + 100) >> 2] = 8
    c[(g + 104) >> 2] = 0
    c[(g + 124) >> 2] = 0
    c[(g + 128) >> 2] = 0
    c[(g + 132) >> 2] = 0
    c[(g + 148) >> 2] = 1
    c[(g + 152) >> 2] = 2
    c[(g + 144) >> 2] = 4096
    c[(g + 140) >> 2] = 4
    c[(g + 136) >> 2] = 4
    c[(g + 156) >> 2] = 0
    c[(g + 160) >> 2] = 0
    c[(g + 164) >> 2] = 0
    c[(g + 108) >> 2] = 8
    c[(g + 112) >> 2] = 256
    c[(g + 116) >> 2] = -128
    c[(g + 120) >> 2] = 127
    c[(g + 88) >> 2] = 0
    a[(g + 168) >> 0] = 0
    a[(g + 169) >> 0] = 0
    a[(g + 171) >> 0] = 0
    c[f >> 2] = g
    h = wh(16) | 0
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    c[h >> 2] = 3216
    c[(h + 12) >> 2] = g
    i = (f + 4) | 0
    c[i >> 2] = h
    c[e >> 2] = g
    c[(e + 4) >> 2] = g
    xd(f, e)
    e = (b + 12) | 0
    g = c[e >> 2] | 0
    if (g >>> 0 < (c[(b + 16) >> 2] | 0) >>> 0) {
      c[g >> 2] = c[f >> 2]
      c[(g + 4) >> 2] = c[i >> 2]
      c[f >> 2] = 0
      c[i >> 2] = 0
      c[e >> 2] = g + 8
      eb = d
      return
    }
    kd((b + 8) | 0, f)
    f = c[i >> 2] | 0
    if (!f) {
      eb = d
      return
    }
    i = (f + 4) | 0
    b = c[i >> 2] | 0
    c[i >> 2] = b + -1
    if (b | 0) {
      eb = d
      return
    }
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    eb = d
    return
  }
  function Bf(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    f = (d + 8) | 0
    g = wh(176) | 0
    h = c[(b + 4) >> 2] | 0
    c[g >> 2] = 3244
    c[(g + 4) >> 2] = h
    c[(g + 12) >> 2] = 16
    c[(g + 16) >> 2] = 1
    c[(g + 20) >> 2] = 8
    c[(g + 24) >> 2] = 0
    c[(g + 44) >> 2] = 0
    c[(g + 48) >> 2] = 0
    c[(g + 52) >> 2] = 0
    c[(g + 68) >> 2] = 1
    c[(g + 72) >> 2] = 2
    c[(g + 64) >> 2] = 4096
    c[(g + 60) >> 2] = 4
    c[(g + 56) >> 2] = 4
    c[(g + 76) >> 2] = 0
    c[(g + 80) >> 2] = 0
    c[(g + 84) >> 2] = 0
    c[(g + 28) >> 2] = 16
    c[(g + 32) >> 2] = 65536
    c[(g + 36) >> 2] = -32768
    c[(g + 40) >> 2] = 32767
    c[(g + 8) >> 2] = 0
    c[(g + 92) >> 2] = 16
    c[(g + 96) >> 2] = 1
    c[(g + 100) >> 2] = 8
    c[(g + 104) >> 2] = 0
    c[(g + 124) >> 2] = 0
    c[(g + 128) >> 2] = 0
    c[(g + 132) >> 2] = 0
    c[(g + 148) >> 2] = 1
    c[(g + 152) >> 2] = 2
    c[(g + 144) >> 2] = 4096
    c[(g + 140) >> 2] = 4
    c[(g + 136) >> 2] = 4
    c[(g + 156) >> 2] = 0
    c[(g + 160) >> 2] = 0
    c[(g + 164) >> 2] = 0
    c[(g + 108) >> 2] = 16
    c[(g + 112) >> 2] = 65536
    c[(g + 116) >> 2] = -32768
    c[(g + 120) >> 2] = 32767
    c[(g + 88) >> 2] = 0
    a[(g + 168) >> 0] = 0
    a[(g + 169) >> 0] = 0
    a[(g + 172) >> 0] = 0
    c[f >> 2] = g
    h = wh(16) | 0
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    c[h >> 2] = 3268
    c[(h + 12) >> 2] = g
    i = (f + 4) | 0
    c[i >> 2] = h
    c[e >> 2] = g
    c[(e + 4) >> 2] = g
    xd(f, e)
    e = (b + 12) | 0
    g = c[e >> 2] | 0
    if (g >>> 0 < (c[(b + 16) >> 2] | 0) >>> 0) {
      c[g >> 2] = c[f >> 2]
      c[(g + 4) >> 2] = c[i >> 2]
      c[f >> 2] = 0
      c[i >> 2] = 0
      c[e >> 2] = g + 8
      eb = d
      return
    }
    kd((b + 8) | 0, f)
    f = c[i >> 2] | 0
    if (!f) {
      eb = d
      return
    }
    i = (f + 4) | 0
    b = c[i >> 2] | 0
    c[i >> 2] = b + -1
    if (b | 0) {
      eb = d
      return
    }
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    eb = d
    return
  }
  function Cf(a) {
    a = a | 0
    c[a >> 2] = 3192
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    return
  }
  function Df(a) {
    a = a | 0
    c[a >> 2] = 3192
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    yh(a)
    return
  }
  function Ef(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0
    e = c[(b + 4) >> 2] | 0
    if (!(a[(b + 169) >> 0] | 0)) xc((b + 88) | 0)
    f = (b + 170) | 0
    g = (b + 171) | 0
    if (!(a[g >> 0] | 0)) {
      h = c[e >> 2] | 0
      i = (h + 8) | 0
      j = c[h >> 2] | 0
      h = c[i >> 2] | 0
      c[i >> 2] = h + 1
      k = a[(j + h) >> 0] | 0
    } else {
      h = a[f >> 0] | 0
      j = ((kf((b + 88) | 0, e, c[(b + 124) >> 2] | 0) | 0) + h) | 0
      h = c[(b + 112) >> 2] | 0
      if ((j | 0) < 0) l = (j + h) | 0
      else l = (j - (j >>> 0 < h >>> 0 ? 0 : h)) | 0
      k = l & 255
    }
    a[d >> 0] = k
    l = (d + 1) | 0
    if (a[g >> 0] | 0) {
      a[f >> 0] = k
      return l | 0
    }
    a[g >> 0] = 1
    a[f >> 0] = k
    return l | 0
  }
  function Ff(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Gf(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function Hf(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 14633 ? (a + 12) | 0 : 0) | 0
  }
  function If(a) {
    a = a | 0
    yh(a)
    return
  }
  function Jf(a) {
    a = a | 0
    c[a >> 2] = 3244
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    return
  }
  function Kf(a) {
    a = a | 0
    c[a >> 2] = 3244
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    yh(a)
    return
  }
  function Lf(e, f) {
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0
    g = c[(e + 4) >> 2] | 0
    if (!(a[(e + 169) >> 0] | 0)) xc((e + 88) | 0)
    h = (e + 170) | 0
    i = (e + 172) | 0
    if (!(a[i >> 0] | 0)) {
      j = c[g >> 2] | 0
      k = (j + 8) | 0
      l = c[j >> 2] | 0
      m = c[k >> 2] | 0
      c[k >> 2] = m + 1
      a[f >> 0] = a[(l + m) >> 0] | 0
      m = c[j >> 2] | 0
      j = c[k >> 2] | 0
      c[k >> 2] = j + 1
      k = a[(m + j) >> 0] | 0
      a[(f + 1) >> 0] = k
      n = ((((k << 24) >> 24) << 8) | d[f >> 0]) & 65535
    } else {
      k = b[h >> 1] | 0
      j = ((kf((e + 88) | 0, g, c[(e + 124) >> 2] | 0) | 0) + k) | 0
      k = c[(e + 112) >> 2] | 0
      if ((j | 0) < 0) o = (j + k) | 0
      else o = (j - (j >>> 0 < k >>> 0 ? 0 : k)) | 0
      k = o & 65535
      a[(f + 1) >> 0] = (k & 65535) >>> 8
      a[f >> 0] = o
      n = k
    }
    k = (f + 2) | 0
    if (a[i >> 0] | 0) {
      b[h >> 1] = n
      return k | 0
    }
    a[i >> 0] = 1
    b[h >> 1] = n
    return k | 0
  }
  function Mf(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Nf(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function Of(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 15131 ? (a + 12) | 0 : 0) | 0
  }
  function Pf(a) {
    a = a | 0
    yh(a)
    return
  }
  function Qf(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    f = (d + 8) | 0
    g = wh(172) | 0
    h = c[(b + 4) >> 2] | 0
    c[g >> 2] = 3296
    c[(g + 4) >> 2] = h
    c[(g + 12) >> 2] = 8
    c[(g + 16) >> 2] = 1
    c[(g + 20) >> 2] = 8
    c[(g + 24) >> 2] = 0
    c[(g + 44) >> 2] = 0
    c[(g + 48) >> 2] = 0
    c[(g + 52) >> 2] = 0
    c[(g + 68) >> 2] = 1
    c[(g + 72) >> 2] = 2
    c[(g + 64) >> 2] = 4096
    c[(g + 60) >> 2] = 4
    c[(g + 56) >> 2] = 4
    c[(g + 76) >> 2] = 0
    c[(g + 80) >> 2] = 0
    c[(g + 84) >> 2] = 0
    c[(g + 28) >> 2] = 8
    c[(g + 32) >> 2] = 256
    c[(g + 36) >> 2] = -128
    c[(g + 40) >> 2] = 127
    c[(g + 8) >> 2] = 0
    c[(g + 92) >> 2] = 8
    c[(g + 96) >> 2] = 1
    c[(g + 100) >> 2] = 8
    c[(g + 104) >> 2] = 0
    c[(g + 124) >> 2] = 0
    c[(g + 128) >> 2] = 0
    c[(g + 132) >> 2] = 0
    c[(g + 148) >> 2] = 1
    c[(g + 152) >> 2] = 2
    c[(g + 144) >> 2] = 4096
    c[(g + 140) >> 2] = 4
    c[(g + 136) >> 2] = 4
    c[(g + 156) >> 2] = 0
    c[(g + 160) >> 2] = 0
    c[(g + 164) >> 2] = 0
    c[(g + 108) >> 2] = 8
    c[(g + 112) >> 2] = 256
    c[(g + 116) >> 2] = -128
    c[(g + 120) >> 2] = 127
    c[(g + 88) >> 2] = 0
    a[(g + 168) >> 0] = 0
    a[(g + 169) >> 0] = 0
    a[(g + 171) >> 0] = 0
    c[f >> 2] = g
    h = wh(16) | 0
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    c[h >> 2] = 3320
    c[(h + 12) >> 2] = g
    i = (f + 4) | 0
    c[i >> 2] = h
    c[e >> 2] = g
    c[(e + 4) >> 2] = g
    xd(f, e)
    e = (b + 12) | 0
    g = c[e >> 2] | 0
    if (g >>> 0 < (c[(b + 16) >> 2] | 0) >>> 0) {
      c[g >> 2] = c[f >> 2]
      c[(g + 4) >> 2] = c[i >> 2]
      c[f >> 2] = 0
      c[i >> 2] = 0
      c[e >> 2] = g + 8
      eb = d
      return
    }
    kd((b + 8) | 0, f)
    f = c[i >> 2] | 0
    if (!f) {
      eb = d
      return
    }
    i = (f + 4) | 0
    b = c[i >> 2] | 0
    c[i >> 2] = b + -1
    if (b | 0) {
      eb = d
      return
    }
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    eb = d
    return
  }
  function Rf(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    f = (d + 8) | 0
    g = wh(176) | 0
    h = c[(b + 4) >> 2] | 0
    c[g >> 2] = 3348
    c[(g + 4) >> 2] = h
    c[(g + 12) >> 2] = 16
    c[(g + 16) >> 2] = 1
    c[(g + 20) >> 2] = 8
    c[(g + 24) >> 2] = 0
    c[(g + 44) >> 2] = 0
    c[(g + 48) >> 2] = 0
    c[(g + 52) >> 2] = 0
    c[(g + 68) >> 2] = 1
    c[(g + 72) >> 2] = 2
    c[(g + 64) >> 2] = 4096
    c[(g + 60) >> 2] = 4
    c[(g + 56) >> 2] = 4
    c[(g + 76) >> 2] = 0
    c[(g + 80) >> 2] = 0
    c[(g + 84) >> 2] = 0
    c[(g + 28) >> 2] = 16
    c[(g + 32) >> 2] = 65536
    c[(g + 36) >> 2] = -32768
    c[(g + 40) >> 2] = 32767
    c[(g + 8) >> 2] = 0
    c[(g + 92) >> 2] = 16
    c[(g + 96) >> 2] = 1
    c[(g + 100) >> 2] = 8
    c[(g + 104) >> 2] = 0
    c[(g + 124) >> 2] = 0
    c[(g + 128) >> 2] = 0
    c[(g + 132) >> 2] = 0
    c[(g + 148) >> 2] = 1
    c[(g + 152) >> 2] = 2
    c[(g + 144) >> 2] = 4096
    c[(g + 140) >> 2] = 4
    c[(g + 136) >> 2] = 4
    c[(g + 156) >> 2] = 0
    c[(g + 160) >> 2] = 0
    c[(g + 164) >> 2] = 0
    c[(g + 108) >> 2] = 16
    c[(g + 112) >> 2] = 65536
    c[(g + 116) >> 2] = -32768
    c[(g + 120) >> 2] = 32767
    c[(g + 88) >> 2] = 0
    a[(g + 168) >> 0] = 0
    a[(g + 169) >> 0] = 0
    a[(g + 172) >> 0] = 0
    c[f >> 2] = g
    h = wh(16) | 0
    c[(h + 4) >> 2] = 0
    c[(h + 8) >> 2] = 0
    c[h >> 2] = 3372
    c[(h + 12) >> 2] = g
    i = (f + 4) | 0
    c[i >> 2] = h
    c[e >> 2] = g
    c[(e + 4) >> 2] = g
    xd(f, e)
    e = (b + 12) | 0
    g = c[e >> 2] | 0
    if (g >>> 0 < (c[(b + 16) >> 2] | 0) >>> 0) {
      c[g >> 2] = c[f >> 2]
      c[(g + 4) >> 2] = c[i >> 2]
      c[f >> 2] = 0
      c[i >> 2] = 0
      c[e >> 2] = g + 8
      eb = d
      return
    }
    kd((b + 8) | 0, f)
    f = c[i >> 2] | 0
    if (!f) {
      eb = d
      return
    }
    i = (f + 4) | 0
    b = c[i >> 2] | 0
    c[i >> 2] = b + -1
    if (b | 0) {
      eb = d
      return
    }
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    eb = d
    return
  }
  function Sf(a) {
    a = a | 0
    c[a >> 2] = 3296
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    return
  }
  function Tf(a) {
    a = a | 0
    c[a >> 2] = 3296
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    yh(a)
    return
  }
  function Uf(b, e) {
    b = b | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0
    f = c[(b + 4) >> 2] | 0
    if (!(a[(b + 169) >> 0] | 0)) xc((b + 88) | 0)
    g = (b + 170) | 0
    h = (b + 171) | 0
    if (!(a[h >> 0] | 0)) {
      i = c[f >> 2] | 0
      j = (i + 8) | 0
      k = c[i >> 2] | 0
      i = c[j >> 2] | 0
      c[j >> 2] = i + 1
      l = a[(k + i) >> 0] | 0
    } else {
      i = d[g >> 0] | 0
      k = ((kf((b + 88) | 0, f, c[(b + 124) >> 2] | 0) | 0) + i) | 0
      i = c[(b + 112) >> 2] | 0
      if ((k | 0) < 0) m = (k + i) | 0
      else m = (k - (k >>> 0 < i >>> 0 ? 0 : i)) | 0
      l = m & 255
    }
    a[e >> 0] = l
    m = (e + 1) | 0
    if (a[h >> 0] | 0) {
      a[g >> 0] = l
      return m | 0
    }
    a[h >> 0] = 1
    a[g >> 0] = l
    return m | 0
  }
  function Vf(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function Wf(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function Xf(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 15629 ? (a + 12) | 0 : 0) | 0
  }
  function Yf(a) {
    a = a | 0
    yh(a)
    return
  }
  function Zf(a) {
    a = a | 0
    c[a >> 2] = 3348
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    return
  }
  function _f(a) {
    a = a | 0
    c[a >> 2] = 3348
    yc((a + 88) | 0)
    ud((a + 8) | 0)
    yh(a)
    return
  }
  function $f(f, g) {
    f = f | 0
    g = g | 0
    var h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0
    h = c[(f + 4) >> 2] | 0
    if (!(a[(f + 169) >> 0] | 0)) xc((f + 88) | 0)
    i = (f + 170) | 0
    j = (f + 172) | 0
    if (!(a[j >> 0] | 0)) {
      k = c[h >> 2] | 0
      l = (k + 8) | 0
      m = c[k >> 2] | 0
      n = c[l >> 2] | 0
      c[l >> 2] = n + 1
      a[g >> 0] = a[(m + n) >> 0] | 0
      n = c[k >> 2] | 0
      k = c[l >> 2] | 0
      c[l >> 2] = k + 1
      l = a[(n + k) >> 0] | 0
      a[(g + 1) >> 0] = l
      o = ((((l << 24) >> 24) << 8) | d[g >> 0]) & 65535
    } else {
      l = e[i >> 1] | 0
      k = ((kf((f + 88) | 0, h, c[(f + 124) >> 2] | 0) | 0) + l) | 0
      l = c[(f + 112) >> 2] | 0
      if ((k | 0) < 0) p = (k + l) | 0
      else p = (k - (k >>> 0 < l >>> 0 ? 0 : l)) | 0
      l = p & 65535
      a[(g + 1) >> 0] = (l & 65535) >>> 8
      a[g >> 0] = p
      o = l
    }
    l = (g + 2) | 0
    if (a[j >> 0] | 0) {
      b[i >> 1] = o
      return l | 0
    }
    a[j >> 0] = 1
    b[i >> 1] = o
    return l | 0
  }
  function ag(a) {
    a = a | 0
    sh(a)
    yh(a)
    return
  }
  function bg(a) {
    a = a | 0
    var b = 0
    b = c[(a + 12) >> 2] | 0
    if (!b) return
    ob[c[((c[b >> 2] | 0) + 4) >> 2] & 255](b)
    return
  }
  function cg(a, b) {
    a = a | 0
    b = b | 0
    return ((c[(b + 4) >> 2] | 0) == 16127 ? (a + 12) | 0 : 0) | 0
  }
  function dg(a) {
    a = a | 0
    yh(a)
    return
  }
  function eg(a) {
    a = a | 0
    return 1456
  }
  function fg(a) {
    a = a | 0
    if (!a) return
    gg(a)
    yh(a)
    return
  }
  function gg(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0
    c[a >> 2] = 0
    b = (a + 4) | 0
    d = c[b >> 2] | 0
    c[b >> 2] = 0
    if (
      d | 0
        ? ((e = (d + 4) | 0),
          (f = c[e >> 2] | 0),
          (c[e >> 2] = f + -1),
          (f | 0) == 0)
        : 0
    ) {
      ob[c[((c[d >> 2] | 0) + 8) >> 2] & 255](d)
      th(d)
    }
    c[(a + 8) >> 2] = 0
    d = (a + 12) | 0
    a = c[d >> 2] | 0
    c[d >> 2] = 0
    if (a | 0) {
      f = (a + 4) | 0
      e = c[f >> 2] | 0
      c[f >> 2] = e + -1
      if (!e) {
        ob[c[((c[a >> 2] | 0) + 8) >> 2] & 255](a)
        th(a)
      }
      a = c[d >> 2] | 0
      if (
        a | 0
          ? ((d = (a + 4) | 0),
            (e = c[d >> 2] | 0),
            (c[d >> 2] = e + -1),
            (e | 0) == 0)
          : 0
      ) {
        ob[c[((c[a >> 2] | 0) + 8) >> 2] & 255](a)
        th(a)
      }
    }
    a = c[b >> 2] | 0
    if (!a) return
    b = (a + 4) | 0
    e = c[b >> 2] | 0
    c[b >> 2] = e + -1
    if (e | 0) return
    ob[c[((c[a >> 2] | 0) + 8) >> 2] & 255](a)
    th(a)
    return
  }
  function hg() {
    var a = 0
    a = wh(16) | 0
    c[a >> 2] = 0
    c[(a + 4) >> 2] = 0
    c[(a + 8) >> 2] = 0
    c[(a + 12) >> 2] = 0
    return a | 0
  }
  function ig(a) {
    a = a | 0
    return hb[a & 3]() | 0
  }
  function jg(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0
    f = c[a >> 2] | 0
    g = c[(a + 4) >> 2] | 0
    a = (b + (g >> 1)) | 0
    if (!(g & 1)) {
      h = f
      qb[h & 7](a, d, e)
      return
    } else {
      h = c[((c[a >> 2] | 0) + f) >> 2] | 0
      qb[h & 7](a, d, e)
      return
    }
  }
  function kg(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0
    e = c[a >> 2] | 0
    f = c[(a + 4) >> 2] | 0
    a = (b + (f >> 1)) | 0
    if (!(f & 1)) {
      g = e
      pb[g & 15](a, d)
      return
    } else {
      g = c[((c[a >> 2] | 0) + e) >> 2] | 0
      pb[g & 15](a, d)
      return
    }
  }
  function lg(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0
    d = c[a >> 2] | 0
    e = c[(a + 4) >> 2] | 0
    a = (b + (e >> 1)) | 0
    if (!(e & 1)) f = d
    else f = c[((c[a >> 2] | 0) + d) >> 2] | 0
    return ib[f & 15](a) | 0
  }
  function mg(a) {
    a = a | 0
    return 1496
  }
  function ng(a) {
    a = a | 0
    if (!a) return
    og(a)
    yh(a)
    return
  }
  function og(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0
    c[a >> 2] = 0
    b = (a + 4) | 0
    d = c[b >> 2] | 0
    c[b >> 2] = 0
    if (
      d | 0
        ? ((e = (d + 4) | 0),
          (f = c[e >> 2] | 0),
          (c[e >> 2] = f + -1),
          (f | 0) == 0)
        : 0
    ) {
      ob[c[((c[d >> 2] | 0) + 8) >> 2] & 255](d)
      th(d)
    }
    d = (a + 16) | 0
    c[d >> 2] = 0
    f = (a + 20) | 0
    e = c[f >> 2] | 0
    c[f >> 2] = 0
    if (e) {
      g = (e + 4) | 0
      h = c[g >> 2] | 0
      c[g >> 2] = h + -1
      if (!h) {
        ob[c[((c[e >> 2] | 0) + 8) >> 2] & 255](e)
        th(e)
      }
      e = c[f >> 2] | 0
      c[d >> 2] = 0
      c[f >> 2] = 0
      if (e | 0) {
        h = (e + 4) | 0
        g = c[h >> 2] | 0
        c[h >> 2] = g + -1
        if (!g) {
          ob[c[((c[e >> 2] | 0) + 8) >> 2] & 255](e)
          th(e)
        }
        e = c[f >> 2] | 0
        if (
          e | 0
            ? ((g = (e + 4) | 0),
              (h = c[g >> 2] | 0),
              (c[g >> 2] = h + -1),
              (h | 0) == 0)
            : 0
        ) {
          ob[c[((c[e >> 2] | 0) + 8) >> 2] & 255](e)
          th(e)
        }
      }
    } else {
      c[d >> 2] = 0
      c[f >> 2] = 0
    }
    f = c[(a + 12) >> 2] | 0
    if (
      f | 0
        ? ((a = (f + 4) | 0),
          (d = c[a >> 2] | 0),
          (c[a >> 2] = d + -1),
          (d | 0) == 0)
        : 0
    ) {
      ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
      th(f)
    }
    f = c[b >> 2] | 0
    if (!f) return
    b = (f + 4) | 0
    d = c[b >> 2] | 0
    c[b >> 2] = d + -1
    if (d | 0) return
    ob[c[((c[f >> 2] | 0) + 8) >> 2] & 255](f)
    th(f)
    return
  }
  function pg() {
    var a = 0
    a = wh(24) | 0
    c[a >> 2] = 0
    c[(a + 4) >> 2] = 0
    c[(a + 8) >> 2] = 0
    c[(a + 12) >> 2] = 0
    c[(a + 16) >> 2] = 0
    c[(a + 20) >> 2] = 0
    return a | 0
  }
  function qg(a) {
    a = a | 0
    return hb[a & 3]() | 0
  }
  function rg(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0
    f = c[a >> 2] | 0
    g = c[(a + 4) >> 2] | 0
    a = (b + (g >> 1)) | 0
    if (!(g & 1)) {
      h = f
      qb[h & 7](a, d, e)
      return
    } else {
      h = c[((c[a >> 2] | 0) + f) >> 2] | 0
      qb[h & 7](a, d, e)
      return
    }
  }
  function sg(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0
    e = c[a >> 2] | 0
    f = c[(a + 4) >> 2] | 0
    a = (b + (f >> 1)) | 0
    if (!(f & 1)) {
      g = e
      pb[g & 15](a, d)
      return
    } else {
      g = c[((c[a >> 2] | 0) + e) >> 2] | 0
      pb[g & 15](a, d)
      return
    }
  }
  function tg(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0
    e = c[a >> 2] | 0
    f = c[(a + 4) >> 2] | 0
    a = (b + (f >> 1)) | 0
    if (!(f & 1)) {
      g = e
      pb[g & 15](a, d)
      return
    } else {
      g = c[((c[a >> 2] | 0) + e) >> 2] | 0
      pb[g & 15](a, d)
      return
    }
  }
  function ug() {
    zb(0)
    return
  }
  function vg() {
    wg()
    return
  }
  function wg() {
    ba(2072, 16386)
    T(2088, 16391, 1, 1, 0)
    Z(2096, 16396, 1, -128, 127)
    Z(2112, 16401, 1, -128, 127)
    Z(2104, 16413, 1, 0, 255)
    Z(2120, 16427, 2, -32768, 32767)
    Z(2128, 16433, 2, 0, 65535)
    Z(2136, 16448, 4, -2147483648, 2147483647)
    Z(2144, 16452, 4, 0, -1)
    Z(2152, 16465, 4, -2147483648, 2147483647)
    Z(2160, 16470, 4, 0, -1)
    Y(2168, 16484, 4)
    Y(2176, 16490, 8)
    $(1536, 16497)
    $(1560, 16509)
    aa(1584, 4, 16542)
    X(1608, 16555)
    _(1616, 0, 16571)
    _(1624, 0, 16601)
    _(1632, 1, 16638)
    _(1640, 2, 16677)
    _(1648, 3, 16708)
    _(1656, 4, 16748)
    _(1664, 5, 16777)
    _(1672, 4, 16815)
    _(1680, 5, 16845)
    _(1624, 0, 16884)
    _(1632, 1, 16916)
    _(1640, 2, 16949)
    _(1648, 3, 16982)
    _(1656, 4, 17016)
    _(1664, 5, 17049)
    _(1688, 6, 17083)
    _(1696, 7, 17114)
    _(1704, 7, 17146)
    return
  }
  function xg(a) {
    a = a | 0
    return ch(c[(a + 4) >> 2] | 0) | 0
  }
  function yg(a) {
    a = a | 0
    var b = 0,
      d = 0
    b = eb
    eb = (eb + 16) | 0
    d = b
    c[d >> 2] = Dg(c[(a + 60) >> 2] | 0) | 0
    a = Bg(S(6, d | 0) | 0) | 0
    eb = b
    return a | 0
  }
  function zg(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0
    e = eb
    eb = (eb + 48) | 0
    f = (e + 32) | 0
    g = (e + 16) | 0
    h = e
    i = (a + 28) | 0
    j = c[i >> 2] | 0
    c[h >> 2] = j
    k = (a + 20) | 0
    l = ((c[k >> 2] | 0) - j) | 0
    c[(h + 4) >> 2] = l
    c[(h + 8) >> 2] = b
    c[(h + 12) >> 2] = d
    b = (l + d) | 0
    l = (a + 60) | 0
    c[g >> 2] = c[l >> 2]
    c[(g + 4) >> 2] = h
    c[(g + 8) >> 2] = 2
    j = Bg(R(146, g | 0) | 0) | 0
    a: do
      if ((b | 0) != (j | 0)) {
        g = 2
        m = b
        n = h
        o = j
        while (1) {
          if ((o | 0) < 0) break
          m = (m - o) | 0
          p = c[(n + 4) >> 2] | 0
          q = o >>> 0 > p >>> 0
          r = q ? (n + 8) | 0 : n
          s = (g + ((q << 31) >> 31)) | 0
          t = (o - (q ? p : 0)) | 0
          c[r >> 2] = (c[r >> 2] | 0) + t
          p = (r + 4) | 0
          c[p >> 2] = (c[p >> 2] | 0) - t
          c[f >> 2] = c[l >> 2]
          c[(f + 4) >> 2] = r
          c[(f + 8) >> 2] = s
          o = Bg(R(146, f | 0) | 0) | 0
          if ((m | 0) == (o | 0)) {
            u = 3
            break a
          } else {
            g = s
            n = r
          }
        }
        c[(a + 16) >> 2] = 0
        c[i >> 2] = 0
        c[k >> 2] = 0
        c[a >> 2] = c[a >> 2] | 32
        if ((g | 0) == 2) v = 0
        else v = (d - (c[(n + 4) >> 2] | 0)) | 0
      } else u = 3
    while (0)
    if ((u | 0) == 3) {
      u = c[(a + 44) >> 2] | 0
      c[(a + 16) >> 2] = u + (c[(a + 48) >> 2] | 0)
      a = u
      c[i >> 2] = a
      c[k >> 2] = a
      v = d
    }
    eb = e
    return v | 0
  }
  function Ag(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    f = eb
    eb = (eb + 32) | 0
    g = (f + 8) | 0
    h = f
    c[g >> 2] = c[(a + 60) >> 2]
    c[(g + 4) >> 2] = d
    c[(g + 8) >> 2] = b
    c[(g + 12) >> 2] = h
    c[(g + 16) >> 2] = e
    if ((Bg(Q(140, g | 0) | 0) | 0) < 0) {
      g = h
      c[g >> 2] = -1
      c[(g + 4) >> 2] = -1
      i = -1
      j = -1
    } else {
      g = h
      i = c[(g + 4) >> 2] | 0
      j = c[g >> 2] | 0
    }
    u(i | 0)
    eb = f
    return j | 0
  }
  function Bg(a) {
    a = a | 0
    var b = 0
    if (a >>> 0 > 4294963200) {
      c[(Cg() | 0) >> 2] = 0 - a
      b = -1
    } else b = a
    return b | 0
  }
  function Cg() {
    return 18832
  }
  function Dg(a) {
    a = a | 0
    return a | 0
  }
  function Eg(b, c, d) {
    b = b | 0
    c = c | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    a: do
      if (!d) e = 0
      else {
        f = b
        g = d
        h = c
        while (1) {
          i = a[f >> 0] | 0
          j = a[h >> 0] | 0
          if ((i << 24) >> 24 != (j << 24) >> 24) break
          g = (g + -1) | 0
          if (!g) {
            e = 0
            break a
          } else {
            f = (f + 1) | 0
            h = (h + 1) | 0
          }
        }
        e = ((i & 255) - (j & 255)) | 0
      }
    while (0)
    return e | 0
  }
  function Fg(a) {
    a = a | 0
    return (((a + -48) | 0) >>> 0 < 10) | 0
  }
  function Gg(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    return Jg(a, b, c, 1, 8) | 0
  }
  function Hg(b, e, f, g, h, i) {
    b = b | 0
    e = +e
    f = f | 0
    g = g | 0
    h = h | 0
    i = i | 0
    var j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0.0,
      u = 0,
      w = 0.0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0.0,
      G = 0,
      H = 0,
      I = 0,
      J = 0.0,
      K = 0,
      L = 0,
      M = 0,
      N = 0,
      O = 0,
      P = 0,
      Q = 0.0,
      R = 0,
      S = 0,
      T = 0,
      U = 0,
      V = 0,
      W = 0,
      X = 0,
      Y = 0,
      Z = 0,
      _ = 0,
      $ = 0,
      aa = 0,
      ba = 0,
      ca = 0,
      da = 0,
      ea = 0,
      fa = 0,
      ga = 0,
      ha = 0.0,
      ia = 0.0,
      ja = 0,
      ka = 0,
      la = 0,
      ma = 0,
      na = 0,
      oa = 0,
      pa = 0,
      qa = 0,
      ra = 0,
      sa = 0,
      ta = 0,
      ua = 0,
      va = 0,
      wa = 0,
      xa = 0,
      ya = 0,
      za = 0,
      Aa = 0,
      Ba = 0,
      Ca = 0,
      Da = 0,
      Ea = 0,
      Fa = 0,
      Ga = 0,
      Ha = 0
    j = eb
    eb = (eb + 560) | 0
    k = (j + 32) | 0
    l = (j + 536) | 0
    m = j
    n = m
    o = (j + 540) | 0
    c[l >> 2] = 0
    p = (o + 12) | 0
    q = $g(e) | 0
    s = v() | 0
    if ((s | 0) < 0) {
      t = -e
      u = $g(t) | 0
      w = t
      x = 1
      y = 17818
      z = v() | 0
      A = u
    } else {
      w = e
      x = (((h & 2049) | 0) != 0) & 1
      y = ((h & 2048) | 0) == 0 ? (((h & 1) | 0) == 0 ? 17819 : 17824) : 17821
      z = s
      A = q
    }
    do
      if ((0 == 0) & (((z & 2146435072) | 0) == 2146435072)) {
        q = ((i & 32) | 0) != 0
        A = (x + 3) | 0
        Ug(b, 32, f, A, h & -65537)
        Ng(b, y, x)
        Ng(
          b,
          (w != w) | (0.0 != 0.0) ? (q ? 17845 : 17849) : q ? 17837 : 17841,
          3
        )
        Ug(b, 32, f, A, h ^ 8192)
        B = A
      } else {
        e = +ah(w, l) * 2.0
        A = e != 0.0
        if (A) c[l >> 2] = (c[l >> 2] | 0) + -1
        q = i | 32
        if ((q | 0) == 97) {
          s = i & 32
          u = (s | 0) == 0 ? y : (y + 9) | 0
          C = x | 2
          D = (12 - g) | 0
          do
            if (!((g >>> 0 > 11) | ((D | 0) == 0))) {
              t = 8.0
              E = D
              do {
                E = (E + -1) | 0
                t = t * 16.0
              } while ((E | 0) != 0)
              if ((a[u >> 0] | 0) == 45) {
                F = -(t + (-e - t))
                break
              } else {
                F = e + t - t
                break
              }
            } else F = e
          while (0)
          D = c[l >> 2] | 0
          E = (D | 0) < 0 ? (0 - D) | 0 : D
          G = Sg(E, (((E | 0) < 0) << 31) >> 31, p) | 0
          if ((G | 0) == (p | 0)) {
            E = (o + 11) | 0
            a[E >> 0] = 48
            H = E
          } else H = G
          a[(H + -1) >> 0] = ((D >> 31) & 2) + 43
          D = (H + -2) | 0
          a[D >> 0] = i + 15
          G = (g | 0) < 1
          E = ((h & 8) | 0) == 0
          I = m
          J = F
          while (1) {
            K = ~~J
            L = (I + 1) | 0
            a[I >> 0] = s | d[(640 + K) >> 0]
            J = (J - +(K | 0)) * 16.0
            if (((L - n) | 0) == 1 ? !(E & (G & (J == 0.0))) : 0) {
              a[L >> 0] = 46
              M = (I + 2) | 0
            } else M = L
            if (!(J != 0.0)) break
            else I = M
          }
          I = M
          if ((g | 0) != 0 ? ((-2 - n + I) | 0) < (g | 0) : 0) {
            G = p
            E = D
            N = (g + 2 + G - E) | 0
            O = G
            P = E
          } else {
            E = p
            G = D
            N = (E - n - G + I) | 0
            O = E
            P = G
          }
          G = (N + C) | 0
          Ug(b, 32, f, G, h)
          Ng(b, u, C)
          Ug(b, 48, f, G, h ^ 65536)
          E = (I - n) | 0
          Ng(b, m, E)
          I = (O - P) | 0
          Ug(b, 48, (N - (E + I)) | 0, 0, 0)
          Ng(b, D, I)
          Ug(b, 32, f, G, h ^ 8192)
          B = G
          break
        }
        G = (g | 0) < 0 ? 6 : g
        if (A) {
          I = ((c[l >> 2] | 0) + -28) | 0
          c[l >> 2] = I
          Q = e * 268435456.0
          R = I
        } else {
          Q = e
          R = c[l >> 2] | 0
        }
        I = (R | 0) < 0 ? k : (k + 288) | 0
        E = I
        J = Q
        do {
          s = ~~J >>> 0
          c[E >> 2] = s
          E = (E + 4) | 0
          J = (J - +(s >>> 0)) * 1.0e9
        } while (J != 0.0)
        A = I
        if ((R | 0) > 0) {
          D = I
          C = E
          u = R
          while (1) {
            s = (u | 0) < 29 ? u : 29
            L = (C + -4) | 0
            if (L >>> 0 >= D >>> 0) {
              K = L
              L = 0
              do {
                S = Si(c[K >> 2] | 0, 0, s | 0) | 0
                T = Mi(S | 0, v() | 0, L | 0, 0) | 0
                S = v() | 0
                L = Qi(T | 0, S | 0, 1e9, 0) | 0
                U = Li(L | 0, v() | 0, 1e9, 0) | 0
                V = Ni(T | 0, S | 0, U | 0, v() | 0) | 0
                v() | 0
                c[K >> 2] = V
                K = (K + -4) | 0
              } while (K >>> 0 >= D >>> 0)
              if (L) {
                K = (D + -4) | 0
                c[K >> 2] = L
                W = K
              } else W = D
            } else W = D
            a: do
              if (C >>> 0 > W >>> 0) {
                K = C
                while (1) {
                  V = (K + -4) | 0
                  if (c[V >> 2] | 0) {
                    X = K
                    break a
                  }
                  if (V >>> 0 > W >>> 0) K = V
                  else {
                    X = V
                    break
                  }
                }
              } else X = C
            while (0)
            L = ((c[l >> 2] | 0) - s) | 0
            c[l >> 2] = L
            if ((L | 0) > 0) {
              D = W
              C = X
              u = L
            } else {
              Y = W
              Z = X
              _ = L
              break
            }
          }
        } else {
          Y = I
          Z = E
          _ = R
        }
        if ((_ | 0) < 0) {
          u = (((((G + 25) | 0) / 9) | 0) + 1) | 0
          C = (q | 0) == 102
          D = Y
          L = Z
          K = _
          while (1) {
            V = (0 - K) | 0
            U = (V | 0) < 9 ? V : 9
            if (D >>> 0 < L >>> 0) {
              V = ((1 << U) + -1) | 0
              S = 1e9 >>> U
              T = 0
              $ = D
              do {
                aa = c[$ >> 2] | 0
                c[$ >> 2] = (aa >>> U) + T
                T = r(aa & V, S) | 0
                $ = ($ + 4) | 0
              } while ($ >>> 0 < L >>> 0)
              $ = (c[D >> 2] | 0) == 0 ? (D + 4) | 0 : D
              if (!T) {
                ba = L
                ca = $
              } else {
                c[L >> 2] = T
                ba = (L + 4) | 0
                ca = $
              }
            } else {
              ba = L
              ca = (c[D >> 2] | 0) == 0 ? (D + 4) | 0 : D
            }
            $ = C ? I : ca
            S = (((ba - $) >> 2) | 0) > (u | 0) ? ($ + (u << 2)) | 0 : ba
            K = ((c[l >> 2] | 0) + U) | 0
            c[l >> 2] = K
            if ((K | 0) >= 0) {
              da = ca
              ea = S
              break
            } else {
              D = ca
              L = S
            }
          }
        } else {
          da = Y
          ea = Z
        }
        if (da >>> 0 < ea >>> 0) {
          L = (((A - da) >> 2) * 9) | 0
          D = c[da >> 2] | 0
          if (D >>> 0 < 10) fa = L
          else {
            K = L
            L = 10
            while (1) {
              L = (L * 10) | 0
              u = (K + 1) | 0
              if (D >>> 0 < L >>> 0) {
                fa = u
                break
              } else K = u
            }
          }
        } else fa = 0
        K = (q | 0) == 103
        L = (G | 0) != 0
        D = (G - ((q | 0) == 102 ? 0 : fa) + (((L & K) << 31) >> 31)) | 0
        if ((D | 0) < ((((((ea - A) >> 2) * 9) | 0) + -9) | 0)) {
          u = (D + 9216) | 0
          D = ((u | 0) / 9) | 0
          C = (I + 4 + ((D + -1024) << 2)) | 0
          E = (u - ((D * 9) | 0)) | 0
          if ((E | 0) < 8) {
            D = E
            E = 10
            while (1) {
              u = (E * 10) | 0
              if ((D | 0) < 7) {
                D = (D + 1) | 0
                E = u
              } else {
                ga = u
                break
              }
            }
          } else ga = 10
          E = c[C >> 2] | 0
          D = ((E >>> 0) / (ga >>> 0)) | 0
          q = (E - (r(D, ga) | 0)) | 0
          u = ((C + 4) | 0) == (ea | 0)
          if (!(u & ((q | 0) == 0))) {
            t = ((D & 1) | 0) == 0 ? 9007199254740992.0 : 9007199254740994.0
            D = ga >>> 1
            J = q >>> 0 < D >>> 0 ? 0.5 : u & ((q | 0) == (D | 0)) ? 1.0 : 1.5
            if (!x) {
              ha = J
              ia = t
            } else {
              D = (a[y >> 0] | 0) == 45
              ha = D ? -J : J
              ia = D ? -t : t
            }
            D = (E - q) | 0
            c[C >> 2] = D
            if (ia + ha != ia) {
              q = (D + ga) | 0
              c[C >> 2] = q
              if (q >>> 0 > 999999999) {
                q = C
                D = da
                while (1) {
                  E = (q + -4) | 0
                  c[q >> 2] = 0
                  if (E >>> 0 < D >>> 0) {
                    u = (D + -4) | 0
                    c[u >> 2] = 0
                    ja = u
                  } else ja = D
                  u = ((c[E >> 2] | 0) + 1) | 0
                  c[E >> 2] = u
                  if (u >>> 0 > 999999999) {
                    q = E
                    D = ja
                  } else {
                    ka = E
                    la = ja
                    break
                  }
                }
              } else {
                ka = C
                la = da
              }
              D = (((A - la) >> 2) * 9) | 0
              q = c[la >> 2] | 0
              if (q >>> 0 < 10) {
                ma = ka
                na = D
                oa = la
              } else {
                E = D
                D = 10
                while (1) {
                  D = (D * 10) | 0
                  u = (E + 1) | 0
                  if (q >>> 0 < D >>> 0) {
                    ma = ka
                    na = u
                    oa = la
                    break
                  } else E = u
                }
              }
            } else {
              ma = C
              na = fa
              oa = da
            }
          } else {
            ma = C
            na = fa
            oa = da
          }
          E = (ma + 4) | 0
          pa = na
          qa = ea >>> 0 > E >>> 0 ? E : ea
          ra = oa
        } else {
          pa = fa
          qa = ea
          ra = da
        }
        E = (0 - pa) | 0
        b: do
          if (qa >>> 0 > ra >>> 0) {
            D = qa
            while (1) {
              q = (D + -4) | 0
              if (c[q >> 2] | 0) {
                sa = D
                ta = 1
                break b
              }
              if (q >>> 0 > ra >>> 0) D = q
              else {
                sa = q
                ta = 0
                break
              }
            }
          } else {
            sa = qa
            ta = 0
          }
        while (0)
        do
          if (K) {
            C = (G + ((L ^ 1) & 1)) | 0
            if (((C | 0) > (pa | 0)) & ((pa | 0) > -5)) {
              ua = (i + -1) | 0
              va = (C + -1 - pa) | 0
            } else {
              ua = (i + -2) | 0
              va = (C + -1) | 0
            }
            if (!(h & 8)) {
              if (ta ? ((C = c[(sa + -4) >> 2] | 0), (C | 0) != 0) : 0)
                if (!((C >>> 0) % 10 | 0)) {
                  D = 0
                  U = 10
                  while (1) {
                    U = (U * 10) | 0
                    T = (D + 1) | 0
                    if ((C >>> 0) % (U >>> 0) | 0 | 0) {
                      wa = T
                      break
                    } else D = T
                  }
                } else wa = 0
              else wa = 9
              D = (((((sa - A) >> 2) * 9) | 0) + -9) | 0
              if ((ua | 32 | 0) == 102) {
                U = (D - wa) | 0
                C = (U | 0) > 0 ? U : 0
                xa = ua
                ya = (va | 0) < (C | 0) ? va : C
                break
              } else {
                C = (D + pa - wa) | 0
                D = (C | 0) > 0 ? C : 0
                xa = ua
                ya = (va | 0) < (D | 0) ? va : D
                break
              }
            } else {
              xa = ua
              ya = va
            }
          } else {
            xa = i
            ya = G
          }
        while (0)
        G = (ya | 0) != 0
        A = G ? 1 : (h >>> 3) & 1
        L = (xa | 32 | 0) == 102
        if (L) {
          za = 0
          Aa = (pa | 0) > 0 ? pa : 0
        } else {
          K = (pa | 0) < 0 ? E : pa
          D = Sg(K, (((K | 0) < 0) << 31) >> 31, p) | 0
          K = p
          if (((K - D) | 0) < 2) {
            C = D
            while (1) {
              U = (C + -1) | 0
              a[U >> 0] = 48
              if (((K - U) | 0) < 2) C = U
              else {
                Ba = U
                break
              }
            }
          } else Ba = D
          a[(Ba + -1) >> 0] = ((pa >> 31) & 2) + 43
          C = (Ba + -2) | 0
          a[C >> 0] = xa
          za = C
          Aa = (K - C) | 0
        }
        C = (x + 1 + ya + A + Aa) | 0
        Ug(b, 32, f, C, h)
        Ng(b, y, x)
        Ug(b, 48, f, C, h ^ 65536)
        if (L) {
          E = ra >>> 0 > I >>> 0 ? I : ra
          U = (m + 9) | 0
          T = U
          q = (m + 8) | 0
          u = E
          do {
            S = Sg(c[u >> 2] | 0, 0, U) | 0
            if ((u | 0) == (E | 0))
              if ((S | 0) == (U | 0)) {
                a[q >> 0] = 48
                Ca = q
              } else Ca = S
            else if (S >>> 0 > m >>> 0) {
              Vi(m | 0, 48, (S - n) | 0) | 0
              $ = S
              while (1) {
                V = ($ + -1) | 0
                if (V >>> 0 > m >>> 0) $ = V
                else {
                  Ca = V
                  break
                }
              }
            } else Ca = S
            Ng(b, Ca, (T - Ca) | 0)
            u = (u + 4) | 0
          } while (u >>> 0 <= I >>> 0)
          if (!((((h & 8) | 0) == 0) & (G ^ 1))) Ng(b, 17853, 1)
          if ((u >>> 0 < sa >>> 0) & ((ya | 0) > 0)) {
            I = ya
            T = u
            while (1) {
              q = Sg(c[T >> 2] | 0, 0, U) | 0
              if (q >>> 0 > m >>> 0) {
                Vi(m | 0, 48, (q - n) | 0) | 0
                E = q
                while (1) {
                  L = (E + -1) | 0
                  if (L >>> 0 > m >>> 0) E = L
                  else {
                    Da = L
                    break
                  }
                }
              } else Da = q
              Ng(b, Da, (I | 0) < 9 ? I : 9)
              T = (T + 4) | 0
              E = (I + -9) | 0
              if (!((T >>> 0 < sa >>> 0) & ((I | 0) > 9))) {
                Ea = E
                break
              } else I = E
            }
          } else Ea = ya
          Ug(b, 48, (Ea + 9) | 0, 9, 0)
        } else {
          I = ta ? sa : (ra + 4) | 0
          if ((ra >>> 0 < I >>> 0) & ((ya | 0) > -1)) {
            T = (m + 9) | 0
            U = ((h & 8) | 0) == 0
            u = T
            G = (0 - n) | 0
            E = (m + 8) | 0
            S = ya
            L = ra
            while (1) {
              A = Sg(c[L >> 2] | 0, 0, T) | 0
              if ((A | 0) == (T | 0)) {
                a[E >> 0] = 48
                Fa = E
              } else Fa = A
              do
                if ((L | 0) == (ra | 0)) {
                  A = (Fa + 1) | 0
                  Ng(b, Fa, 1)
                  if (U & ((S | 0) < 1)) {
                    Ga = A
                    break
                  }
                  Ng(b, 17853, 1)
                  Ga = A
                } else {
                  if (Fa >>> 0 <= m >>> 0) {
                    Ga = Fa
                    break
                  }
                  Vi(m | 0, 48, (Fa + G) | 0) | 0
                  A = Fa
                  while (1) {
                    K = (A + -1) | 0
                    if (K >>> 0 > m >>> 0) A = K
                    else {
                      Ga = K
                      break
                    }
                  }
                }
              while (0)
              q = (u - Ga) | 0
              Ng(b, Ga, (S | 0) > (q | 0) ? q : S)
              A = (S - q) | 0
              L = (L + 4) | 0
              if (!((L >>> 0 < I >>> 0) & ((A | 0) > -1))) {
                Ha = A
                break
              } else S = A
            }
          } else Ha = ya
          Ug(b, 48, (Ha + 18) | 0, 18, 0)
          Ng(b, za, (p - za) | 0)
        }
        Ug(b, 32, f, C, h ^ 8192)
        B = C
      }
    while (0)
    eb = j
    return ((B | 0) < (f | 0) ? f : B) | 0
  }
  function Ig(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0.0
    d = ((c[b >> 2] | 0) + (8 - 1)) & ~(8 - 1)
    e = +g[d >> 3]
    c[b >> 2] = d + 8
    g[a >> 3] = e
    return
  }
  function Jg(b, d, e, f, g) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0
    h = eb
    eb = (eb + 224) | 0
    i = (h + 208) | 0
    j = (h + 160) | 0
    k = (h + 80) | 0
    l = h
    m = j
    n = (m + 40) | 0
    do {
      c[m >> 2] = 0
      m = (m + 4) | 0
    } while ((m | 0) < (n | 0))
    c[i >> 2] = c[e >> 2]
    if ((Kg(0, d, i, k, j, f, g) | 0) < 0) o = -1
    else {
      if ((c[(b + 76) >> 2] | 0) > -1) p = Lg(b) | 0
      else p = 0
      e = c[b >> 2] | 0
      m = e & 32
      if ((a[(b + 74) >> 0] | 0) < 1) c[b >> 2] = e & -33
      e = (b + 48) | 0
      if (!(c[e >> 2] | 0)) {
        n = (b + 44) | 0
        q = c[n >> 2] | 0
        c[n >> 2] = l
        r = (b + 28) | 0
        c[r >> 2] = l
        s = (b + 20) | 0
        c[s >> 2] = l
        c[e >> 2] = 80
        t = (b + 16) | 0
        c[t >> 2] = l + 80
        l = Kg(b, d, i, k, j, f, g) | 0
        if (!q) u = l
        else {
          lb[c[(b + 36) >> 2] & 7](b, 0, 0) | 0
          v = (c[s >> 2] | 0) == 0 ? -1 : l
          c[n >> 2] = q
          c[e >> 2] = 0
          c[t >> 2] = 0
          c[r >> 2] = 0
          c[s >> 2] = 0
          u = v
        }
      } else u = Kg(b, d, i, k, j, f, g) | 0
      g = c[b >> 2] | 0
      c[b >> 2] = g | m
      if (p | 0) Mg(b)
      o = ((g & 32) | 0) == 0 ? u : -1
    }
    eb = h
    return o | 0
  }
  function Kg(d, e, f, h, i, j, k) {
    d = d | 0
    e = e | 0
    f = f | 0
    h = h | 0
    i = i | 0
    j = j | 0
    k = k | 0
    var l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0,
      I = 0,
      J = 0,
      K = 0,
      L = 0,
      M = 0,
      N = 0,
      O = 0,
      P = 0,
      Q = 0,
      R = 0,
      S = 0,
      T = 0,
      U = 0,
      V = 0,
      W = 0,
      X = 0,
      Y = 0,
      Z = 0,
      _ = 0,
      $ = 0,
      aa = 0,
      ba = 0,
      ca = 0,
      da = 0,
      ea = 0,
      fa = 0,
      ga = 0,
      ha = 0,
      ia = 0,
      ja = 0,
      ka = 0,
      la = 0,
      ma = 0,
      na = 0,
      oa = 0,
      pa = 0,
      qa = 0,
      ra = 0,
      sa = 0,
      ta = 0,
      ua = 0,
      va = 0,
      wa = 0,
      xa = 0,
      ya = 0,
      za = 0,
      Aa = 0,
      Ba = 0
    l = eb
    eb = (eb + 64) | 0
    m = (l + 56) | 0
    n = (l + 40) | 0
    o = l
    p = (l + 48) | 0
    q = (l + 60) | 0
    c[m >> 2] = e
    e = (d | 0) != 0
    r = (o + 40) | 0
    s = r
    t = (o + 39) | 0
    o = (p + 4) | 0
    u = 0
    w = 0
    x = 0
    a: while (1) {
      y = u
      z = w
      while (1) {
        do
          if ((z | 0) > -1)
            if ((y | 0) > ((2147483647 - z) | 0)) {
              c[(Cg() | 0) >> 2] = 75
              A = -1
              break
            } else {
              A = (y + z) | 0
              break
            }
          else A = z
        while (0)
        B = c[m >> 2] | 0
        C = a[B >> 0] | 0
        if (!((C << 24) >> 24)) {
          D = 92
          break a
        }
        E = C
        C = B
        b: while (1) {
          switch ((E << 24) >> 24) {
            case 37: {
              D = 10
              break b
              break
            }
            case 0: {
              F = C
              break b
              break
            }
            default: {
            }
          }
          G = (C + 1) | 0
          c[m >> 2] = G
          E = a[G >> 0] | 0
          C = G
        }
        c: do
          if ((D | 0) == 10) {
            D = 0
            E = C
            G = C
            while (1) {
              if ((a[(G + 1) >> 0] | 0) != 37) {
                F = E
                break c
              }
              H = (E + 1) | 0
              G = (G + 2) | 0
              c[m >> 2] = G
              if ((a[G >> 0] | 0) != 37) {
                F = H
                break
              } else E = H
            }
          }
        while (0)
        y = (F - B) | 0
        if (e) Ng(d, B, y)
        if (!y) break
        else z = A
      }
      z = (Fg(a[((c[m >> 2] | 0) + 1) >> 0] | 0) | 0) == 0
      y = c[m >> 2] | 0
      if (!z ? (a[(y + 2) >> 0] | 0) == 36 : 0) {
        I = ((a[(y + 1) >> 0] | 0) + -48) | 0
        J = 1
        K = 3
      } else {
        I = -1
        J = x
        K = 1
      }
      z = (y + K) | 0
      c[m >> 2] = z
      y = a[z >> 0] | 0
      C = (((y << 24) >> 24) + -32) | 0
      if ((C >>> 0 > 31) | ((((1 << C) & 75913) | 0) == 0)) {
        L = 0
        M = y
        N = z
      } else {
        y = 0
        E = C
        C = z
        while (1) {
          z = (1 << E) | y
          G = (C + 1) | 0
          c[m >> 2] = G
          H = a[G >> 0] | 0
          E = (((H << 24) >> 24) + -32) | 0
          if ((E >>> 0 > 31) | ((((1 << E) & 75913) | 0) == 0)) {
            L = z
            M = H
            N = G
            break
          } else {
            y = z
            C = G
          }
        }
      }
      if ((M << 24) >> 24 == 42) {
        if (
          (Fg(a[(N + 1) >> 0] | 0) | 0) != 0
            ? ((C = c[m >> 2] | 0), (a[(C + 2) >> 0] | 0) == 36)
            : 0
        ) {
          y = (C + 1) | 0
          c[(i + (((a[y >> 0] | 0) + -48) << 2)) >> 2] = 10
          O = c[(h + (((a[y >> 0] | 0) + -48) << 3)) >> 2] | 0
          P = 1
          Q = (C + 3) | 0
        } else {
          if (J | 0) {
            R = -1
            break
          }
          if (e) {
            C = ((c[f >> 2] | 0) + (4 - 1)) & ~(4 - 1)
            y = c[C >> 2] | 0
            c[f >> 2] = C + 4
            S = y
          } else S = 0
          O = S
          P = 0
          Q = ((c[m >> 2] | 0) + 1) | 0
        }
        c[m >> 2] = Q
        y = (O | 0) < 0
        T = y ? (0 - O) | 0 : O
        U = y ? L | 8192 : L
        V = P
        W = Q
      } else {
        y = Og(m) | 0
        if ((y | 0) < 0) {
          R = -1
          break
        }
        T = y
        U = L
        V = J
        W = c[m >> 2] | 0
      }
      do
        if ((a[W >> 0] | 0) == 46) {
          y = (W + 1) | 0
          if ((a[y >> 0] | 0) != 42) {
            c[m >> 2] = y
            y = Og(m) | 0
            X = y
            Y = c[m >> 2] | 0
            break
          }
          if (
            Fg(a[(W + 2) >> 0] | 0) | 0
              ? ((y = c[m >> 2] | 0), (a[(y + 3) >> 0] | 0) == 36)
              : 0
          ) {
            C = (y + 2) | 0
            c[(i + (((a[C >> 0] | 0) + -48) << 2)) >> 2] = 10
            E = c[(h + (((a[C >> 0] | 0) + -48) << 3)) >> 2] | 0
            C = (y + 4) | 0
            c[m >> 2] = C
            X = E
            Y = C
            break
          }
          if (V | 0) {
            R = -1
            break a
          }
          if (e) {
            C = ((c[f >> 2] | 0) + (4 - 1)) & ~(4 - 1)
            E = c[C >> 2] | 0
            c[f >> 2] = C + 4
            Z = E
          } else Z = 0
          E = ((c[m >> 2] | 0) + 2) | 0
          c[m >> 2] = E
          X = Z
          Y = E
        } else {
          X = -1
          Y = W
        }
      while (0)
      E = 0
      C = Y
      while (1) {
        if ((((a[C >> 0] | 0) + -65) | 0) >>> 0 > 57) {
          R = -1
          break a
        }
        y = C
        C = (C + 1) | 0
        c[m >> 2] = C
        _ = a[((a[y >> 0] | 0) + -65 + (176 + ((E * 58) | 0))) >> 0] | 0
        $ = _ & 255
        if ((($ + -1) | 0) >>> 0 >= 8) break
        else E = $
      }
      if (!((_ << 24) >> 24)) {
        R = -1
        break
      }
      y = (I | 0) > -1
      do
        if ((_ << 24) >> 24 == 19)
          if (y) {
            R = -1
            break a
          } else D = 54
        else {
          if (y) {
            c[(i + (I << 2)) >> 2] = $
            G = (h + (I << 3)) | 0
            z = c[(G + 4) >> 2] | 0
            H = n
            c[H >> 2] = c[G >> 2]
            c[(H + 4) >> 2] = z
            D = 54
            break
          }
          if (!e) {
            R = 0
            break a
          }
          Pg(n, $, f, k)
          aa = c[m >> 2] | 0
          D = 55
        }
      while (0)
      if ((D | 0) == 54) {
        D = 0
        if (e) {
          aa = C
          D = 55
        } else ba = 0
      }
      d: do
        if ((D | 0) == 55) {
          D = 0
          y = a[(aa + -1) >> 0] | 0
          z = ((E | 0) != 0) & (((y & 15) | 0) == 3) ? y & -33 : y
          y = U & -65537
          H = ((U & 8192) | 0) == 0 ? U : y
          e: do
            switch (z | 0) {
              case 110: {
                switch (((E & 255) << 24) >> 24) {
                  case 0: {
                    c[c[n >> 2] >> 2] = A
                    ba = 0
                    break d
                    break
                  }
                  case 1: {
                    c[c[n >> 2] >> 2] = A
                    ba = 0
                    break d
                    break
                  }
                  case 2: {
                    G = c[n >> 2] | 0
                    c[G >> 2] = A
                    c[(G + 4) >> 2] = (((A | 0) < 0) << 31) >> 31
                    ba = 0
                    break d
                    break
                  }
                  case 3: {
                    b[c[n >> 2] >> 1] = A
                    ba = 0
                    break d
                    break
                  }
                  case 4: {
                    a[c[n >> 2] >> 0] = A
                    ba = 0
                    break d
                    break
                  }
                  case 6: {
                    c[c[n >> 2] >> 2] = A
                    ba = 0
                    break d
                    break
                  }
                  case 7: {
                    G = c[n >> 2] | 0
                    c[G >> 2] = A
                    c[(G + 4) >> 2] = (((A | 0) < 0) << 31) >> 31
                    ba = 0
                    break d
                    break
                  }
                  default: {
                    ba = 0
                    break d
                  }
                }
                break
              }
              case 112: {
                ca = 120
                da = X >>> 0 > 8 ? X : 8
                ea = H | 8
                D = 67
                break
              }
              case 88:
              case 120: {
                ca = z
                da = X
                ea = H
                D = 67
                break
              }
              case 111: {
                G = n
                fa = Rg(c[G >> 2] | 0, c[(G + 4) >> 2] | 0, r) | 0
                G = (s - fa) | 0
                ga = fa
                ha = 0
                ia = 17801
                ja =
                  (((H & 8) | 0) == 0) | ((X | 0) > (G | 0)) ? X : (G + 1) | 0
                ka = H
                D = 73
                break
              }
              case 105:
              case 100: {
                G = n
                fa = c[G >> 2] | 0
                la = c[(G + 4) >> 2] | 0
                if ((la | 0) < 0) {
                  G = Ni(0, 0, fa | 0, la | 0) | 0
                  ma = v() | 0
                  na = n
                  c[na >> 2] = G
                  c[(na + 4) >> 2] = ma
                  oa = 1
                  pa = 17801
                  qa = G
                  ra = ma
                  D = 72
                  break e
                } else {
                  oa = (((H & 2049) | 0) != 0) & 1
                  pa =
                    ((H & 2048) | 0) == 0
                      ? ((H & 1) | 0) == 0
                        ? 17801
                        : 17803
                      : 17802
                  qa = fa
                  ra = la
                  D = 72
                  break e
                }
                break
              }
              case 117: {
                la = n
                oa = 0
                pa = 17801
                qa = c[la >> 2] | 0
                ra = c[(la + 4) >> 2] | 0
                D = 72
                break
              }
              case 99: {
                a[t >> 0] = c[n >> 2]
                sa = t
                ta = 0
                ua = 17801
                va = 1
                wa = y
                xa = s
                break
              }
              case 115: {
                la = c[n >> 2] | 0
                fa = (la | 0) == 0 ? 17811 : la
                la = Tg(fa, 0, X) | 0
                ma = (la | 0) == 0
                sa = fa
                ta = 0
                ua = 17801
                va = ma ? X : (la - fa) | 0
                wa = y
                xa = ma ? (fa + X) | 0 : la
                break
              }
              case 67: {
                c[p >> 2] = c[n >> 2]
                c[o >> 2] = 0
                c[n >> 2] = p
                ya = -1
                D = 79
                break
              }
              case 83: {
                if (!X) {
                  Ug(d, 32, T, 0, H)
                  za = 0
                  D = 89
                } else {
                  ya = X
                  D = 79
                }
                break
              }
              case 65:
              case 71:
              case 70:
              case 69:
              case 97:
              case 103:
              case 102:
              case 101: {
                ba = jb[j & 1](d, +g[n >> 3], T, X, H, z) | 0
                break d
                break
              }
              default: {
                sa = B
                ta = 0
                ua = 17801
                va = X
                wa = H
                xa = s
              }
            }
          while (0)
          f: do
            if ((D | 0) == 67) {
              D = 0
              z = n
              y = Qg(c[z >> 2] | 0, c[(z + 4) >> 2] | 0, r, ca & 32) | 0
              z = n
              la =
                (((ea & 8) | 0) == 0) |
                (((c[z >> 2] | 0) == 0) & ((c[(z + 4) >> 2] | 0) == 0))
              ga = y
              ha = la ? 0 : 2
              ia = la ? 17801 : (17801 + (ca >>> 4)) | 0
              ja = da
              ka = ea
              D = 73
            } else if ((D | 0) == 72) {
              D = 0
              ga = Sg(qa, ra, r) | 0
              ha = oa
              ia = pa
              ja = X
              ka = H
              D = 73
            } else if ((D | 0) == 79) {
              D = 0
              la = c[n >> 2] | 0
              y = 0
              while (1) {
                z = c[la >> 2] | 0
                if (!z) {
                  Aa = y
                  break
                }
                fa = Vg(q, z) | 0
                Ba = (fa | 0) < 0
                if (Ba | (fa >>> 0 > ((ya - y) | 0) >>> 0)) {
                  D = 83
                  break
                }
                z = (fa + y) | 0
                if (ya >>> 0 > z >>> 0) {
                  la = (la + 4) | 0
                  y = z
                } else {
                  Aa = z
                  break
                }
              }
              if ((D | 0) == 83) {
                D = 0
                if (Ba) {
                  R = -1
                  break a
                } else Aa = y
              }
              Ug(d, 32, T, Aa, H)
              if (!Aa) {
                za = 0
                D = 89
              } else {
                la = c[n >> 2] | 0
                z = 0
                while (1) {
                  fa = c[la >> 2] | 0
                  if (!fa) {
                    za = Aa
                    D = 89
                    break f
                  }
                  ma = Vg(q, fa) | 0
                  z = (ma + z) | 0
                  if ((z | 0) > (Aa | 0)) {
                    za = Aa
                    D = 89
                    break f
                  }
                  Ng(d, q, ma)
                  if (z >>> 0 >= Aa >>> 0) {
                    za = Aa
                    D = 89
                    break
                  } else la = (la + 4) | 0
                }
              }
            }
          while (0)
          if ((D | 0) == 73) {
            D = 0
            la = n
            z = ((c[la >> 2] | 0) != 0) | ((c[(la + 4) >> 2] | 0) != 0)
            la = ((ja | 0) != 0) | z
            y = (s - ga + ((z ^ 1) & 1)) | 0
            sa = la ? ga : r
            ta = ha
            ua = ia
            va = la ? ((ja | 0) > (y | 0) ? ja : y) : 0
            wa = (ja | 0) > -1 ? ka & -65537 : ka
            xa = s
          } else if ((D | 0) == 89) {
            D = 0
            Ug(d, 32, T, za, H ^ 8192)
            ba = (T | 0) > (za | 0) ? T : za
            break
          }
          y = (xa - sa) | 0
          la = (va | 0) < (y | 0) ? y : va
          z = (la + ta) | 0
          ma = (T | 0) < (z | 0) ? z : T
          Ug(d, 32, ma, z, wa)
          Ng(d, ua, ta)
          Ug(d, 48, ma, z, wa ^ 65536)
          Ug(d, 48, la, y, 0)
          Ng(d, sa, y)
          Ug(d, 32, ma, z, wa ^ 8192)
          ba = ma
        }
      while (0)
      u = ba
      w = A
      x = V
    }
    g: do
      if ((D | 0) == 92)
        if (!d)
          if (!x) R = 0
          else {
            V = 1
            while (1) {
              w = c[(i + (V << 2)) >> 2] | 0
              if (!w) break
              Pg((h + (V << 3)) | 0, w, f, k)
              w = (V + 1) | 0
              if (w >>> 0 < 10) V = w
              else {
                R = 1
                break g
              }
            }
            w = V
            while (1) {
              if (c[(i + (w << 2)) >> 2] | 0) {
                R = -1
                break g
              }
              w = (w + 1) | 0
              if (w >>> 0 >= 10) {
                R = 1
                break
              }
            }
          }
        else R = A
    while (0)
    eb = l
    return R | 0
  }
  function Lg(a) {
    a = a | 0
    return 1
  }
  function Mg(a) {
    a = a | 0
    return
  }
  function Ng(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    if (!(c[a >> 2] & 32)) Zg(b, d, a) | 0
    return
  }
  function Og(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0
    if (!(Fg(a[c[b >> 2] >> 0] | 0) | 0)) d = 0
    else {
      e = 0
      while (1) {
        f = c[b >> 2] | 0
        g = (((e * 10) | 0) + -48 + (a[f >> 0] | 0)) | 0
        h = (f + 1) | 0
        c[b >> 2] = h
        if (!(Fg(a[h >> 0] | 0) | 0)) {
          d = g
          break
        } else e = g
      }
    }
    return d | 0
  }
  function Pg(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0.0
    a: do
      if (b >>> 0 <= 20)
        do
          switch (b | 0) {
            case 9: {
              f = ((c[d >> 2] | 0) + (4 - 1)) & ~(4 - 1)
              h = c[f >> 2] | 0
              c[d >> 2] = f + 4
              c[a >> 2] = h
              break a
              break
            }
            case 10: {
              h = ((c[d >> 2] | 0) + (4 - 1)) & ~(4 - 1)
              f = c[h >> 2] | 0
              c[d >> 2] = h + 4
              h = a
              c[h >> 2] = f
              c[(h + 4) >> 2] = (((f | 0) < 0) << 31) >> 31
              break a
              break
            }
            case 11: {
              f = ((c[d >> 2] | 0) + (4 - 1)) & ~(4 - 1)
              h = c[f >> 2] | 0
              c[d >> 2] = f + 4
              f = a
              c[f >> 2] = h
              c[(f + 4) >> 2] = 0
              break a
              break
            }
            case 12: {
              f = ((c[d >> 2] | 0) + (8 - 1)) & ~(8 - 1)
              h = f
              i = c[h >> 2] | 0
              j = c[(h + 4) >> 2] | 0
              c[d >> 2] = f + 8
              f = a
              c[f >> 2] = i
              c[(f + 4) >> 2] = j
              break a
              break
            }
            case 13: {
              j = ((c[d >> 2] | 0) + (4 - 1)) & ~(4 - 1)
              f = c[j >> 2] | 0
              c[d >> 2] = j + 4
              j = ((f & 65535) << 16) >> 16
              f = a
              c[f >> 2] = j
              c[(f + 4) >> 2] = (((j | 0) < 0) << 31) >> 31
              break a
              break
            }
            case 14: {
              j = ((c[d >> 2] | 0) + (4 - 1)) & ~(4 - 1)
              f = c[j >> 2] | 0
              c[d >> 2] = j + 4
              j = a
              c[j >> 2] = f & 65535
              c[(j + 4) >> 2] = 0
              break a
              break
            }
            case 15: {
              j = ((c[d >> 2] | 0) + (4 - 1)) & ~(4 - 1)
              f = c[j >> 2] | 0
              c[d >> 2] = j + 4
              j = ((f & 255) << 24) >> 24
              f = a
              c[f >> 2] = j
              c[(f + 4) >> 2] = (((j | 0) < 0) << 31) >> 31
              break a
              break
            }
            case 16: {
              j = ((c[d >> 2] | 0) + (4 - 1)) & ~(4 - 1)
              f = c[j >> 2] | 0
              c[d >> 2] = j + 4
              j = a
              c[j >> 2] = f & 255
              c[(j + 4) >> 2] = 0
              break a
              break
            }
            case 17: {
              j = ((c[d >> 2] | 0) + (8 - 1)) & ~(8 - 1)
              k = +g[j >> 3]
              c[d >> 2] = j + 8
              g[a >> 3] = k
              break a
              break
            }
            case 18: {
              pb[e & 15](a, d)
              break a
              break
            }
            default:
              break a
          }
        while (0)
    while (0)
    return
  }
  function Qg(b, c, e, f) {
    b = b | 0
    c = c | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0
    if (((b | 0) == 0) & ((c | 0) == 0)) g = e
    else {
      h = e
      e = c
      c = b
      while (1) {
        b = (h + -1) | 0
        a[b >> 0] = d[(640 + (c & 15)) >> 0] | 0 | f
        c = Ri(c | 0, e | 0, 4) | 0
        e = v() | 0
        if (((c | 0) == 0) & ((e | 0) == 0)) {
          g = b
          break
        } else h = b
      }
    }
    return g | 0
  }
  function Rg(b, c, d) {
    b = b | 0
    c = c | 0
    d = d | 0
    var e = 0,
      f = 0
    if (((b | 0) == 0) & ((c | 0) == 0)) e = d
    else {
      f = d
      d = c
      c = b
      while (1) {
        b = (f + -1) | 0
        a[b >> 0] = (c & 7) | 48
        c = Ri(c | 0, d | 0, 3) | 0
        d = v() | 0
        if (((c | 0) == 0) & ((d | 0) == 0)) {
          e = b
          break
        } else f = b
      }
    }
    return e | 0
  }
  function Sg(b, c, d) {
    b = b | 0
    c = c | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0
    if ((c >>> 0 > 0) | (((c | 0) == 0) & (b >>> 0 > 4294967295))) {
      e = d
      f = b
      g = c
      do {
        c = f
        f = Qi(f | 0, g | 0, 10, 0) | 0
        h = g
        g = v() | 0
        i = Li(f | 0, g | 0, 10, 0) | 0
        j = Ni(c | 0, h | 0, i | 0, v() | 0) | 0
        v() | 0
        e = (e + -1) | 0
        a[e >> 0] = (j & 255) | 48
      } while ((h >>> 0 > 9) | (((h | 0) == 9) & (c >>> 0 > 4294967295)))
      k = f
      l = e
    } else {
      k = b
      l = d
    }
    if (!k) m = l
    else {
      d = k
      k = l
      while (1) {
        l = d
        d = ((d >>> 0) / 10) | 0
        b = (k + -1) | 0
        a[b >> 0] = (l - ((d * 10) | 0)) | 48
        if (l >>> 0 < 10) {
          m = b
          break
        } else k = b
      }
    }
    return m | 0
  }
  function Tg(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0
    f = d & 255
    g = (e | 0) != 0
    a: do
      if (g & (((b & 3) | 0) != 0)) {
        h = d & 255
        i = b
        j = e
        while (1) {
          if ((a[i >> 0] | 0) == (h << 24) >> 24) {
            k = i
            l = j
            m = 6
            break a
          }
          n = (i + 1) | 0
          o = (j + -1) | 0
          p = (o | 0) != 0
          if (p & (((n & 3) | 0) != 0)) {
            i = n
            j = o
          } else {
            q = n
            s = o
            t = p
            m = 5
            break
          }
        }
      } else {
        q = b
        s = e
        t = g
        m = 5
      }
    while (0)
    if ((m | 0) == 5)
      if (t) {
        k = q
        l = s
        m = 6
      } else m = 16
    b: do
      if ((m | 0) == 6) {
        s = d & 255
        if ((a[k >> 0] | 0) == (s << 24) >> 24)
          if (!l) {
            m = 16
            break
          } else {
            u = k
            break
          }
        q = r(f, 16843009) | 0
        c: do
          if (l >>> 0 > 3) {
            t = k
            g = l
            while (1) {
              e = c[t >> 2] ^ q
              if ((((e & -2139062144) ^ -2139062144) & (e + -16843009)) | 0) {
                v = g
                w = t
                break c
              }
              e = (t + 4) | 0
              b = (g + -4) | 0
              if (b >>> 0 > 3) {
                t = e
                g = b
              } else {
                x = e
                y = b
                m = 11
                break
              }
            }
          } else {
            x = k
            y = l
            m = 11
          }
        while (0)
        if ((m | 0) == 11)
          if (!y) {
            m = 16
            break
          } else {
            v = y
            w = x
          }
        q = w
        g = v
        while (1) {
          if ((a[q >> 0] | 0) == (s << 24) >> 24) {
            u = q
            break b
          }
          g = (g + -1) | 0
          if (!g) {
            m = 16
            break
          } else q = (q + 1) | 0
        }
      }
    while (0)
    if ((m | 0) == 16) u = 0
    return u | 0
  }
  function Ug(a, b, c, d, e) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0
    f = eb
    eb = (eb + 256) | 0
    g = f
    if (((c | 0) > (d | 0)) & (((e & 73728) | 0) == 0)) {
      e = (c - d) | 0
      Vi(g | 0, ((b << 24) >> 24) | 0, (e >>> 0 < 256 ? e : 256) | 0) | 0
      if (e >>> 0 > 255) {
        b = (c - d) | 0
        d = e
        do {
          Ng(a, g, 256)
          d = (d + -256) | 0
        } while (d >>> 0 > 255)
        h = b & 255
      } else h = e
      Ng(a, g, h)
    }
    eb = f
    return
  }
  function Vg(a, b) {
    a = a | 0
    b = b | 0
    var c = 0
    if (!a) c = 0
    else c = Wg(a, b, 0) | 0
    return c | 0
  }
  function Wg(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0
    do
      if (b) {
        if (d >>> 0 < 128) {
          a[b >> 0] = d
          f = 1
          break
        }
        if (!(c[c[((Xg() | 0) + 188) >> 2] >> 2] | 0))
          if (((d & -128) | 0) == 57216) {
            a[b >> 0] = d
            f = 1
            break
          } else {
            c[(Cg() | 0) >> 2] = 84
            f = -1
            break
          }
        if (d >>> 0 < 2048) {
          a[b >> 0] = (d >>> 6) | 192
          a[(b + 1) >> 0] = (d & 63) | 128
          f = 2
          break
        }
        if ((d >>> 0 < 55296) | (((d & -8192) | 0) == 57344)) {
          a[b >> 0] = (d >>> 12) | 224
          a[(b + 1) >> 0] = ((d >>> 6) & 63) | 128
          a[(b + 2) >> 0] = (d & 63) | 128
          f = 3
          break
        }
        if (((d + -65536) | 0) >>> 0 < 1048576) {
          a[b >> 0] = (d >>> 18) | 240
          a[(b + 1) >> 0] = ((d >>> 12) & 63) | 128
          a[(b + 2) >> 0] = ((d >>> 6) & 63) | 128
          a[(b + 3) >> 0] = (d & 63) | 128
          f = 4
          break
        } else {
          c[(Cg() | 0) >> 2] = 84
          f = -1
          break
        }
      } else f = 1
    while (0)
    return f | 0
  }
  function Xg() {
    return Yg() | 0
  }
  function Yg() {
    return 3448
  }
  function Zg(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0
    f = (e + 16) | 0
    g = c[f >> 2] | 0
    if (!g)
      if (!(_g(e) | 0)) {
        h = c[f >> 2] | 0
        i = 5
      } else j = 0
    else {
      h = g
      i = 5
    }
    a: do
      if ((i | 0) == 5) {
        g = (e + 20) | 0
        f = c[g >> 2] | 0
        k = f
        if (((h - f) | 0) >>> 0 < d >>> 0) {
          j = lb[c[(e + 36) >> 2] & 7](e, b, d) | 0
          break
        }
        b: do
          if (((a[(e + 75) >> 0] | 0) < 0) | ((d | 0) == 0)) {
            l = 0
            m = b
            n = d
            o = k
          } else {
            f = d
            while (1) {
              p = (f + -1) | 0
              if ((a[(b + p) >> 0] | 0) == 10) break
              if (!p) {
                l = 0
                m = b
                n = d
                o = k
                break b
              } else f = p
            }
            p = lb[c[(e + 36) >> 2] & 7](e, b, f) | 0
            if (p >>> 0 < f >>> 0) {
              j = p
              break a
            }
            l = f
            m = (b + f) | 0
            n = (d - f) | 0
            o = c[g >> 2] | 0
          }
        while (0)
        Ti(o | 0, m | 0, n | 0) | 0
        c[g >> 2] = (c[g >> 2] | 0) + n
        j = (l + n) | 0
      }
    while (0)
    return j | 0
  }
  function _g(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0
    d = (b + 74) | 0
    e = a[d >> 0] | 0
    a[d >> 0] = (e + 255) | e
    e = c[b >> 2] | 0
    if (!(e & 8)) {
      c[(b + 8) >> 2] = 0
      c[(b + 4) >> 2] = 0
      d = c[(b + 44) >> 2] | 0
      c[(b + 28) >> 2] = d
      c[(b + 20) >> 2] = d
      c[(b + 16) >> 2] = d + (c[(b + 48) >> 2] | 0)
      f = 0
    } else {
      c[b >> 2] = e | 32
      f = -1
    }
    return f | 0
  }
  function $g(a) {
    a = +a
    var b = 0
    g[h >> 3] = a
    b = c[h >> 2] | 0
    u(c[(h + 4) >> 2] | 0)
    return b | 0
  }
  function ah(a, b) {
    a = +a
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      i = 0.0,
      j = 0.0,
      k = 0,
      l = 0.0
    g[h >> 3] = a
    d = c[h >> 2] | 0
    e = c[(h + 4) >> 2] | 0
    f = Ri(d | 0, e | 0, 52) | 0
    v() | 0
    switch (f & 2047) {
      case 0: {
        if (a != 0.0) {
          i = +ah(a * 18446744073709551616.0, b)
          j = i
          k = ((c[b >> 2] | 0) + -64) | 0
        } else {
          j = a
          k = 0
        }
        c[b >> 2] = k
        l = j
        break
      }
      case 2047: {
        l = a
        break
      }
      default: {
        c[b >> 2] = (f & 2047) + -1022
        c[h >> 2] = d
        c[(h + 4) >> 2] = (e & -2146435073) | 1071644672
        l = +g[h >> 3]
      }
    }
    return +l
  }
  function bh(b) {
    b = b | 0
    var d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0
    d = b
    a: do
      if (!(d & 3)) {
        e = b
        f = 5
      } else {
        g = b
        h = d
        while (1) {
          if (!(a[g >> 0] | 0)) {
            i = h
            break a
          }
          j = (g + 1) | 0
          h = j
          if (!(h & 3)) {
            e = j
            f = 5
            break
          } else g = j
        }
      }
    while (0)
    if ((f | 0) == 5) {
      f = e
      while (1) {
        k = c[f >> 2] | 0
        if (!(((k & -2139062144) ^ -2139062144) & (k + -16843009)))
          f = (f + 4) | 0
        else break
      }
      if (!(((k & 255) << 24) >> 24)) l = f
      else {
        k = f
        while (1) {
          f = (k + 1) | 0
          if (!(a[f >> 0] | 0)) {
            l = f
            break
          } else k = f
        }
      }
      i = l
    }
    return (i - d) | 0
  }
  function ch(a) {
    a = a | 0
    var b = 0,
      c = 0,
      d = 0
    b = ((bh(a) | 0) + 1) | 0
    c = fh(b) | 0
    if (!c) d = 0
    else d = Ti(c | 0, a | 0, b | 0) | 0
    return d | 0
  }
  function dh(b, e) {
    b = b | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0
    f = eb
    eb = (eb + 16) | 0
    g = f
    h = e & 255
    a[g >> 0] = h
    i = (b + 16) | 0
    j = c[i >> 2] | 0
    if (!j)
      if (!(_g(b) | 0)) {
        k = c[i >> 2] | 0
        l = 4
      } else m = -1
    else {
      k = j
      l = 4
    }
    do
      if ((l | 0) == 4) {
        j = (b + 20) | 0
        i = c[j >> 2] | 0
        if (
          i >>> 0 < k >>> 0
            ? ((n = e & 255), (n | 0) != (a[(b + 75) >> 0] | 0))
            : 0
        ) {
          c[j >> 2] = i + 1
          a[i >> 0] = h
          m = n
          break
        }
        if ((lb[c[(b + 36) >> 2] & 7](b, g, 1) | 0) == 1) m = d[g >> 0] | 0
        else m = -1
      }
    while (0)
    eb = f
    return m | 0
  }
  function eh(b, d) {
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0
    if ((c[(d + 76) >> 2] | 0) >= 0 ? (Lg(d) | 0) != 0 : 0) {
      e = b & 255
      f = b & 255
      if (
        (f | 0) != (a[(d + 75) >> 0] | 0)
          ? ((g = (d + 20) | 0),
            (h = c[g >> 2] | 0),
            h >>> 0 < (c[(d + 16) >> 2] | 0) >>> 0)
          : 0
      ) {
        c[g >> 2] = h + 1
        a[h >> 0] = e
        i = f
      } else i = dh(d, b) | 0
      Mg(d)
      j = i
    } else k = 3
    do
      if ((k | 0) == 3) {
        i = b & 255
        f = b & 255
        if (
          (f | 0) != (a[(d + 75) >> 0] | 0)
            ? ((e = (d + 20) | 0),
              (h = c[e >> 2] | 0),
              h >>> 0 < (c[(d + 16) >> 2] | 0) >>> 0)
            : 0
        ) {
          c[e >> 2] = h + 1
          a[h >> 0] = i
          j = f
          break
        }
        j = dh(d, b) | 0
      }
    while (0)
    return j | 0
  }
  function fh(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0,
      I = 0,
      J = 0,
      K = 0,
      L = 0,
      M = 0,
      N = 0,
      O = 0,
      P = 0,
      Q = 0,
      R = 0,
      S = 0,
      T = 0,
      U = 0,
      V = 0,
      W = 0,
      X = 0,
      Y = 0,
      Z = 0,
      _ = 0,
      $ = 0,
      aa = 0,
      ba = 0,
      ca = 0,
      da = 0,
      ea = 0,
      fa = 0,
      ga = 0,
      ha = 0,
      ia = 0,
      ja = 0,
      ka = 0,
      la = 0,
      ma = 0,
      na = 0,
      oa = 0,
      pa = 0,
      qa = 0,
      ra = 0,
      sa = 0,
      ta = 0,
      ua = 0,
      va = 0,
      wa = 0,
      xa = 0,
      ya = 0,
      za = 0,
      Aa = 0,
      Ba = 0,
      Ca = 0,
      Da = 0,
      Ea = 0,
      Fa = 0,
      Ga = 0,
      Ha = 0,
      Ia = 0
    b = eb
    eb = (eb + 16) | 0
    d = b
    do
      if (a >>> 0 < 245) {
        e = a >>> 0 < 11 ? 16 : (a + 11) & -8
        f = e >>> 3
        g = c[4709] | 0
        h = g >>> f
        if ((h & 3) | 0) {
          i = (((h & 1) ^ 1) + f) | 0
          j = (18876 + ((i << 1) << 2)) | 0
          k = (j + 8) | 0
          l = c[k >> 2] | 0
          m = (l + 8) | 0
          n = c[m >> 2] | 0
          if ((n | 0) == (j | 0)) c[4709] = g & ~(1 << i)
          else {
            c[(n + 12) >> 2] = j
            c[k >> 2] = n
          }
          n = i << 3
          c[(l + 4) >> 2] = n | 3
          i = (l + n + 4) | 0
          c[i >> 2] = c[i >> 2] | 1
          o = m
          eb = b
          return o | 0
        }
        m = c[4711] | 0
        if (e >>> 0 > m >>> 0) {
          if (h | 0) {
            i = 2 << f
            n = (h << f) & (i | (0 - i))
            i = ((n & (0 - n)) + -1) | 0
            n = (i >>> 12) & 16
            f = i >>> n
            i = (f >>> 5) & 8
            h = f >>> i
            f = (h >>> 2) & 4
            l = h >>> f
            h = (l >>> 1) & 2
            k = l >>> h
            l = (k >>> 1) & 1
            j = ((i | n | f | h | l) + (k >>> l)) | 0
            l = (18876 + ((j << 1) << 2)) | 0
            k = (l + 8) | 0
            h = c[k >> 2] | 0
            f = (h + 8) | 0
            n = c[f >> 2] | 0
            if ((n | 0) == (l | 0)) {
              i = g & ~(1 << j)
              c[4709] = i
              p = i
            } else {
              c[(n + 12) >> 2] = l
              c[k >> 2] = n
              p = g
            }
            n = j << 3
            j = (n - e) | 0
            c[(h + 4) >> 2] = e | 3
            k = (h + e) | 0
            c[(k + 4) >> 2] = j | 1
            c[(h + n) >> 2] = j
            if (m | 0) {
              n = c[4714] | 0
              h = m >>> 3
              l = (18876 + ((h << 1) << 2)) | 0
              i = 1 << h
              if (!(p & i)) {
                c[4709] = p | i
                q = l
                r = (l + 8) | 0
              } else {
                i = (l + 8) | 0
                q = c[i >> 2] | 0
                r = i
              }
              c[r >> 2] = n
              c[(q + 12) >> 2] = n
              c[(n + 8) >> 2] = q
              c[(n + 12) >> 2] = l
            }
            c[4711] = j
            c[4714] = k
            o = f
            eb = b
            return o | 0
          }
          f = c[4710] | 0
          if (f) {
            k = ((f & (0 - f)) + -1) | 0
            j = (k >>> 12) & 16
            l = k >>> j
            k = (l >>> 5) & 8
            n = l >>> k
            l = (n >>> 2) & 4
            i = n >>> l
            n = (i >>> 1) & 2
            h = i >>> n
            i = (h >>> 1) & 1
            s = c[(19140 + (((k | j | l | n | i) + (h >>> i)) << 2)) >> 2] | 0
            i = s
            h = s
            n = ((c[(s + 4) >> 2] & -8) - e) | 0
            while (1) {
              s = c[(i + 16) >> 2] | 0
              if (!s) {
                l = c[(i + 20) >> 2] | 0
                if (!l) break
                else t = l
              } else t = s
              s = ((c[(t + 4) >> 2] & -8) - e) | 0
              l = s >>> 0 < n >>> 0
              i = t
              h = l ? t : h
              n = l ? s : n
            }
            i = (h + e) | 0
            if (i >>> 0 > h >>> 0) {
              s = c[(h + 24) >> 2] | 0
              l = c[(h + 12) >> 2] | 0
              do
                if ((l | 0) == (h | 0)) {
                  j = (h + 20) | 0
                  k = c[j >> 2] | 0
                  if (!k) {
                    u = (h + 16) | 0
                    v = c[u >> 2] | 0
                    if (!v) {
                      w = 0
                      break
                    } else {
                      x = v
                      y = u
                    }
                  } else {
                    x = k
                    y = j
                  }
                  j = x
                  k = y
                  while (1) {
                    u = (j + 20) | 0
                    v = c[u >> 2] | 0
                    if (!v) {
                      z = (j + 16) | 0
                      A = c[z >> 2] | 0
                      if (!A) break
                      else {
                        B = A
                        C = z
                      }
                    } else {
                      B = v
                      C = u
                    }
                    j = B
                    k = C
                  }
                  c[k >> 2] = 0
                  w = j
                } else {
                  u = c[(h + 8) >> 2] | 0
                  c[(u + 12) >> 2] = l
                  c[(l + 8) >> 2] = u
                  w = l
                }
              while (0)
              do
                if (s | 0) {
                  l = c[(h + 28) >> 2] | 0
                  u = (19140 + (l << 2)) | 0
                  if ((h | 0) == (c[u >> 2] | 0)) {
                    c[u >> 2] = w
                    if (!w) {
                      c[4710] = f & ~(1 << l)
                      break
                    }
                  } else {
                    l = (s + 16) | 0
                    c[((c[l >> 2] | 0) == (h | 0) ? l : (s + 20) | 0) >> 2] = w
                    if (!w) break
                  }
                  c[(w + 24) >> 2] = s
                  l = c[(h + 16) >> 2] | 0
                  if (l | 0) {
                    c[(w + 16) >> 2] = l
                    c[(l + 24) >> 2] = w
                  }
                  l = c[(h + 20) >> 2] | 0
                  if (l | 0) {
                    c[(w + 20) >> 2] = l
                    c[(l + 24) >> 2] = w
                  }
                }
              while (0)
              if (n >>> 0 < 16) {
                s = (n + e) | 0
                c[(h + 4) >> 2] = s | 3
                f = (h + s + 4) | 0
                c[f >> 2] = c[f >> 2] | 1
              } else {
                c[(h + 4) >> 2] = e | 3
                c[(i + 4) >> 2] = n | 1
                c[(i + n) >> 2] = n
                if (m | 0) {
                  f = c[4714] | 0
                  s = m >>> 3
                  l = (18876 + ((s << 1) << 2)) | 0
                  u = 1 << s
                  if (!(u & g)) {
                    c[4709] = u | g
                    D = l
                    E = (l + 8) | 0
                  } else {
                    u = (l + 8) | 0
                    D = c[u >> 2] | 0
                    E = u
                  }
                  c[E >> 2] = f
                  c[(D + 12) >> 2] = f
                  c[(f + 8) >> 2] = D
                  c[(f + 12) >> 2] = l
                }
                c[4711] = n
                c[4714] = i
              }
              o = (h + 8) | 0
              eb = b
              return o | 0
            } else F = e
          } else F = e
        } else F = e
      } else if (a >>> 0 <= 4294967231) {
        l = (a + 11) | 0
        f = l & -8
        u = c[4710] | 0
        if (u) {
          s = (0 - f) | 0
          v = l >>> 8
          if (v)
            if (f >>> 0 > 16777215) G = 31
            else {
              l = (((v + 1048320) | 0) >>> 16) & 8
              z = v << l
              v = (((z + 520192) | 0) >>> 16) & 4
              A = z << v
              z = (((A + 245760) | 0) >>> 16) & 2
              H = (14 - (v | l | z) + ((A << z) >>> 15)) | 0
              G = ((f >>> ((H + 7) | 0)) & 1) | (H << 1)
            }
          else G = 0
          H = c[(19140 + (G << 2)) >> 2] | 0
          a: do
            if (!H) {
              I = 0
              J = 0
              K = s
              L = 61
            } else {
              z = 0
              A = s
              l = H
              v = f << ((G | 0) == 31 ? 0 : (25 - (G >>> 1)) | 0)
              M = 0
              while (1) {
                N = ((c[(l + 4) >> 2] & -8) - f) | 0
                if (N >>> 0 < A >>> 0)
                  if (!N) {
                    O = l
                    P = 0
                    Q = l
                    L = 65
                    break a
                  } else {
                    R = l
                    S = N
                  }
                else {
                  R = z
                  S = A
                }
                N = c[(l + 20) >> 2] | 0
                l = c[(l + 16 + ((v >>> 31) << 2)) >> 2] | 0
                T = ((N | 0) == 0) | ((N | 0) == (l | 0)) ? M : N
                if (!l) {
                  I = T
                  J = R
                  K = S
                  L = 61
                  break
                } else {
                  z = R
                  A = S
                  v = v << 1
                  M = T
                }
              }
            }
          while (0)
          if ((L | 0) == 61) {
            if (((I | 0) == 0) & ((J | 0) == 0)) {
              H = 2 << G
              s = (H | (0 - H)) & u
              if (!s) {
                F = f
                break
              }
              H = ((s & (0 - s)) + -1) | 0
              s = (H >>> 12) & 16
              e = H >>> s
              H = (e >>> 5) & 8
              h = e >>> H
              e = (h >>> 2) & 4
              i = h >>> e
              h = (i >>> 1) & 2
              n = i >>> h
              i = (n >>> 1) & 1
              U = 0
              V = c[(19140 + (((H | s | e | h | i) + (n >>> i)) << 2)) >> 2] | 0
            } else {
              U = J
              V = I
            }
            if (!V) {
              W = U
              X = K
            } else {
              O = U
              P = K
              Q = V
              L = 65
            }
          }
          if ((L | 0) == 65) {
            i = O
            n = P
            h = Q
            while (1) {
              e = ((c[(h + 4) >> 2] & -8) - f) | 0
              s = e >>> 0 < n >>> 0
              H = s ? e : n
              e = s ? h : i
              s = c[(h + 16) >> 2] | 0
              if (!s) Y = c[(h + 20) >> 2] | 0
              else Y = s
              if (!Y) {
                W = e
                X = H
                break
              } else {
                i = e
                n = H
                h = Y
              }
            }
          }
          if (
            ((W | 0) != 0 ? X >>> 0 < (((c[4711] | 0) - f) | 0) >>> 0 : 0)
              ? ((h = (W + f) | 0), h >>> 0 > W >>> 0)
              : 0
          ) {
            n = c[(W + 24) >> 2] | 0
            i = c[(W + 12) >> 2] | 0
            do
              if ((i | 0) == (W | 0)) {
                H = (W + 20) | 0
                e = c[H >> 2] | 0
                if (!e) {
                  s = (W + 16) | 0
                  g = c[s >> 2] | 0
                  if (!g) {
                    Z = 0
                    break
                  } else {
                    _ = g
                    $ = s
                  }
                } else {
                  _ = e
                  $ = H
                }
                H = _
                e = $
                while (1) {
                  s = (H + 20) | 0
                  g = c[s >> 2] | 0
                  if (!g) {
                    m = (H + 16) | 0
                    M = c[m >> 2] | 0
                    if (!M) break
                    else {
                      aa = M
                      ba = m
                    }
                  } else {
                    aa = g
                    ba = s
                  }
                  H = aa
                  e = ba
                }
                c[e >> 2] = 0
                Z = H
              } else {
                s = c[(W + 8) >> 2] | 0
                c[(s + 12) >> 2] = i
                c[(i + 8) >> 2] = s
                Z = i
              }
            while (0)
            do
              if (n) {
                i = c[(W + 28) >> 2] | 0
                s = (19140 + (i << 2)) | 0
                if ((W | 0) == (c[s >> 2] | 0)) {
                  c[s >> 2] = Z
                  if (!Z) {
                    s = u & ~(1 << i)
                    c[4710] = s
                    ca = s
                    break
                  }
                } else {
                  s = (n + 16) | 0
                  c[((c[s >> 2] | 0) == (W | 0) ? s : (n + 20) | 0) >> 2] = Z
                  if (!Z) {
                    ca = u
                    break
                  }
                }
                c[(Z + 24) >> 2] = n
                s = c[(W + 16) >> 2] | 0
                if (s | 0) {
                  c[(Z + 16) >> 2] = s
                  c[(s + 24) >> 2] = Z
                }
                s = c[(W + 20) >> 2] | 0
                if (s) {
                  c[(Z + 20) >> 2] = s
                  c[(s + 24) >> 2] = Z
                  ca = u
                } else ca = u
              } else ca = u
            while (0)
            b: do
              if (X >>> 0 < 16) {
                u = (X + f) | 0
                c[(W + 4) >> 2] = u | 3
                n = (W + u + 4) | 0
                c[n >> 2] = c[n >> 2] | 1
              } else {
                c[(W + 4) >> 2] = f | 3
                c[(h + 4) >> 2] = X | 1
                c[(h + X) >> 2] = X
                n = X >>> 3
                if (X >>> 0 < 256) {
                  u = (18876 + ((n << 1) << 2)) | 0
                  s = c[4709] | 0
                  i = 1 << n
                  if (!(s & i)) {
                    c[4709] = s | i
                    da = u
                    ea = (u + 8) | 0
                  } else {
                    i = (u + 8) | 0
                    da = c[i >> 2] | 0
                    ea = i
                  }
                  c[ea >> 2] = h
                  c[(da + 12) >> 2] = h
                  c[(h + 8) >> 2] = da
                  c[(h + 12) >> 2] = u
                  break
                }
                u = X >>> 8
                if (u)
                  if (X >>> 0 > 16777215) fa = 31
                  else {
                    i = (((u + 1048320) | 0) >>> 16) & 8
                    s = u << i
                    u = (((s + 520192) | 0) >>> 16) & 4
                    n = s << u
                    s = (((n + 245760) | 0) >>> 16) & 2
                    g = (14 - (u | i | s) + ((n << s) >>> 15)) | 0
                    fa = ((X >>> ((g + 7) | 0)) & 1) | (g << 1)
                  }
                else fa = 0
                g = (19140 + (fa << 2)) | 0
                c[(h + 28) >> 2] = fa
                s = (h + 16) | 0
                c[(s + 4) >> 2] = 0
                c[s >> 2] = 0
                s = 1 << fa
                if (!(ca & s)) {
                  c[4710] = ca | s
                  c[g >> 2] = h
                  c[(h + 24) >> 2] = g
                  c[(h + 12) >> 2] = h
                  c[(h + 8) >> 2] = h
                  break
                }
                s = c[g >> 2] | 0
                c: do
                  if (((c[(s + 4) >> 2] & -8) | 0) == (X | 0)) ga = s
                  else {
                    g = X << ((fa | 0) == 31 ? 0 : (25 - (fa >>> 1)) | 0)
                    n = s
                    while (1) {
                      ha = (n + 16 + ((g >>> 31) << 2)) | 0
                      i = c[ha >> 2] | 0
                      if (!i) break
                      if (((c[(i + 4) >> 2] & -8) | 0) == (X | 0)) {
                        ga = i
                        break c
                      } else {
                        g = g << 1
                        n = i
                      }
                    }
                    c[ha >> 2] = h
                    c[(h + 24) >> 2] = n
                    c[(h + 12) >> 2] = h
                    c[(h + 8) >> 2] = h
                    break b
                  }
                while (0)
                s = (ga + 8) | 0
                H = c[s >> 2] | 0
                c[(H + 12) >> 2] = h
                c[s >> 2] = h
                c[(h + 8) >> 2] = H
                c[(h + 12) >> 2] = ga
                c[(h + 24) >> 2] = 0
              }
            while (0)
            o = (W + 8) | 0
            eb = b
            return o | 0
          } else F = f
        } else F = f
      } else F = -1
    while (0)
    W = c[4711] | 0
    if (W >>> 0 >= F >>> 0) {
      ga = (W - F) | 0
      ha = c[4714] | 0
      if (ga >>> 0 > 15) {
        X = (ha + F) | 0
        c[4714] = X
        c[4711] = ga
        c[(X + 4) >> 2] = ga | 1
        c[(ha + W) >> 2] = ga
        c[(ha + 4) >> 2] = F | 3
      } else {
        c[4711] = 0
        c[4714] = 0
        c[(ha + 4) >> 2] = W | 3
        ga = (ha + W + 4) | 0
        c[ga >> 2] = c[ga >> 2] | 1
      }
      o = (ha + 8) | 0
      eb = b
      return o | 0
    }
    ha = c[4712] | 0
    if (ha >>> 0 > F >>> 0) {
      ga = (ha - F) | 0
      c[4712] = ga
      W = c[4715] | 0
      X = (W + F) | 0
      c[4715] = X
      c[(X + 4) >> 2] = ga | 1
      c[(W + 4) >> 2] = F | 3
      o = (W + 8) | 0
      eb = b
      return o | 0
    }
    if (!(c[4827] | 0)) {
      c[4829] = 4096
      c[4828] = 4096
      c[4830] = -1
      c[4831] = -1
      c[4832] = 0
      c[4820] = 0
      c[4827] = (d & -16) ^ 1431655768
      ia = 4096
    } else ia = c[4829] | 0
    d = (F + 48) | 0
    W = (F + 47) | 0
    ga = (ia + W) | 0
    X = (0 - ia) | 0
    ia = ga & X
    if (ia >>> 0 <= F >>> 0) {
      o = 0
      eb = b
      return o | 0
    }
    fa = c[4819] | 0
    if (
      fa | 0
        ? ((ca = c[4817] | 0),
          (da = (ca + ia) | 0),
          (da >>> 0 <= ca >>> 0) | (da >>> 0 > fa >>> 0))
        : 0
    ) {
      o = 0
      eb = b
      return o | 0
    }
    d: do
      if (!(c[4820] & 4)) {
        fa = c[4715] | 0
        e: do
          if (fa) {
            da = 19284
            while (1) {
              ca = c[da >> 2] | 0
              if (
                ca >>> 0 <= fa >>> 0
                  ? ((ca + (c[(da + 4) >> 2] | 0)) | 0) >>> 0 > fa >>> 0
                  : 0
              )
                break
              ca = c[(da + 8) >> 2] | 0
              if (!ca) {
                L = 128
                break e
              } else da = ca
            }
            ca = (ga - ha) & X
            if (ca >>> 0 < 2147483647) {
              ea = Wi(ca | 0) | 0
              if ((ea | 0) == (((c[da >> 2] | 0) + (c[(da + 4) >> 2] | 0)) | 0))
                if ((ea | 0) == (-1 | 0)) ja = ca
                else {
                  ka = ca
                  la = ea
                  L = 145
                  break d
                }
              else {
                ma = ea
                na = ca
                L = 136
              }
            } else ja = 0
          } else L = 128
        while (0)
        do
          if ((L | 0) == 128) {
            fa = Wi(0) | 0
            if (
              (fa | 0) != (-1 | 0)
                ? ((f = fa),
                  (ca = c[4828] | 0),
                  (ea = (ca + -1) | 0),
                  (Z =
                    ((((ea & f) | 0) == 0
                      ? 0
                      : (((ea + f) & (0 - ca)) - f) | 0) +
                      ia) |
                    0),
                  (f = c[4817] | 0),
                  (ca = (Z + f) | 0),
                  (Z >>> 0 > F >>> 0) & (Z >>> 0 < 2147483647))
                : 0
            ) {
              ea = c[4819] | 0
              if (ea | 0 ? (ca >>> 0 <= f >>> 0) | (ca >>> 0 > ea >>> 0) : 0) {
                ja = 0
                break
              }
              ea = Wi(Z | 0) | 0
              if ((ea | 0) == (fa | 0)) {
                ka = Z
                la = fa
                L = 145
                break d
              } else {
                ma = ea
                na = Z
                L = 136
              }
            } else ja = 0
          }
        while (0)
        do
          if ((L | 0) == 136) {
            Z = (0 - na) | 0
            if (
              !(
                (d >>> 0 > na >>> 0) &
                ((na >>> 0 < 2147483647) & ((ma | 0) != (-1 | 0)))
              )
            )
              if ((ma | 0) == (-1 | 0)) {
                ja = 0
                break
              } else {
                ka = na
                la = ma
                L = 145
                break d
              }
            ea = c[4829] | 0
            fa = (W - na + ea) & (0 - ea)
            if (fa >>> 0 >= 2147483647) {
              ka = na
              la = ma
              L = 145
              break d
            }
            if ((Wi(fa | 0) | 0) == (-1 | 0)) {
              Wi(Z | 0) | 0
              ja = 0
              break
            } else {
              ka = (fa + na) | 0
              la = ma
              L = 145
              break d
            }
          }
        while (0)
        c[4820] = c[4820] | 4
        oa = ja
        L = 143
      } else {
        oa = 0
        L = 143
      }
    while (0)
    if (
      ((L | 0) == 143 ? ia >>> 0 < 2147483647 : 0)
        ? ((ja = Wi(ia | 0) | 0),
          (ia = Wi(0) | 0),
          (ma = (ia - ja) | 0),
          (na = ma >>> 0 > ((F + 40) | 0) >>> 0),
          !(
            ((ja | 0) == (-1 | 0)) |
            (na ^ 1) |
            (((ja >>> 0 < ia >>> 0) &
              (((ja | 0) != (-1 | 0)) & ((ia | 0) != (-1 | 0)))) ^
              1)
          ))
        : 0
    ) {
      ka = na ? ma : oa
      la = ja
      L = 145
    }
    if ((L | 0) == 145) {
      ja = ((c[4817] | 0) + ka) | 0
      c[4817] = ja
      if (ja >>> 0 > (c[4818] | 0) >>> 0) c[4818] = ja
      ja = c[4715] | 0
      f: do
        if (ja) {
          oa = 19284
          while (1) {
            pa = c[oa >> 2] | 0
            qa = c[(oa + 4) >> 2] | 0
            if ((la | 0) == ((pa + qa) | 0)) {
              L = 154
              break
            }
            ma = c[(oa + 8) >> 2] | 0
            if (!ma) break
            else oa = ma
          }
          if (
            (
              (L | 0) == 154
                ? ((ma = (oa + 4) | 0), ((c[(oa + 12) >> 2] & 8) | 0) == 0)
                : 0
            )
              ? (la >>> 0 > ja >>> 0) & (pa >>> 0 <= ja >>> 0)
              : 0
          ) {
            c[ma >> 2] = qa + ka
            ma = ((c[4712] | 0) + ka) | 0
            na = (ja + 8) | 0
            ia = ((na & 7) | 0) == 0 ? 0 : (0 - na) & 7
            na = (ja + ia) | 0
            W = (ma - ia) | 0
            c[4715] = na
            c[4712] = W
            c[(na + 4) >> 2] = W | 1
            c[(ja + ma + 4) >> 2] = 40
            c[4716] = c[4831]
            break
          }
          if (la >>> 0 < (c[4713] | 0) >>> 0) c[4713] = la
          ma = (la + ka) | 0
          W = 19284
          while (1) {
            if ((c[W >> 2] | 0) == (ma | 0)) {
              L = 162
              break
            }
            na = c[(W + 8) >> 2] | 0
            if (!na) break
            else W = na
          }
          if ((L | 0) == 162 ? ((c[(W + 12) >> 2] & 8) | 0) == 0 : 0) {
            c[W >> 2] = la
            oa = (W + 4) | 0
            c[oa >> 2] = (c[oa >> 2] | 0) + ka
            oa = (la + 8) | 0
            na = (la + (((oa & 7) | 0) == 0 ? 0 : (0 - oa) & 7)) | 0
            oa = (ma + 8) | 0
            ia = (ma + (((oa & 7) | 0) == 0 ? 0 : (0 - oa) & 7)) | 0
            oa = (na + F) | 0
            d = (ia - na - F) | 0
            c[(na + 4) >> 2] = F | 3
            g: do
              if ((ja | 0) == (ia | 0)) {
                X = ((c[4712] | 0) + d) | 0
                c[4712] = X
                c[4715] = oa
                c[(oa + 4) >> 2] = X | 1
              } else {
                if ((c[4714] | 0) == (ia | 0)) {
                  X = ((c[4711] | 0) + d) | 0
                  c[4711] = X
                  c[4714] = oa
                  c[(oa + 4) >> 2] = X | 1
                  c[(oa + X) >> 2] = X
                  break
                }
                X = c[(ia + 4) >> 2] | 0
                if (((X & 3) | 0) == 1) {
                  ha = X & -8
                  ga = X >>> 3
                  h: do
                    if (X >>> 0 < 256) {
                      fa = c[(ia + 8) >> 2] | 0
                      Z = c[(ia + 12) >> 2] | 0
                      if ((Z | 0) == (fa | 0)) {
                        c[4709] = c[4709] & ~(1 << ga)
                        break
                      } else {
                        c[(fa + 12) >> 2] = Z
                        c[(Z + 8) >> 2] = fa
                        break
                      }
                    } else {
                      fa = c[(ia + 24) >> 2] | 0
                      Z = c[(ia + 12) >> 2] | 0
                      do
                        if ((Z | 0) == (ia | 0)) {
                          ea = (ia + 16) | 0
                          ca = (ea + 4) | 0
                          f = c[ca >> 2] | 0
                          if (!f) {
                            ba = c[ea >> 2] | 0
                            if (!ba) {
                              ra = 0
                              break
                            } else {
                              sa = ba
                              ta = ea
                            }
                          } else {
                            sa = f
                            ta = ca
                          }
                          ca = sa
                          f = ta
                          while (1) {
                            ea = (ca + 20) | 0
                            ba = c[ea >> 2] | 0
                            if (!ba) {
                              aa = (ca + 16) | 0
                              $ = c[aa >> 2] | 0
                              if (!$) break
                              else {
                                ua = $
                                va = aa
                              }
                            } else {
                              ua = ba
                              va = ea
                            }
                            ca = ua
                            f = va
                          }
                          c[f >> 2] = 0
                          ra = ca
                        } else {
                          ea = c[(ia + 8) >> 2] | 0
                          c[(ea + 12) >> 2] = Z
                          c[(Z + 8) >> 2] = ea
                          ra = Z
                        }
                      while (0)
                      if (!fa) break
                      Z = c[(ia + 28) >> 2] | 0
                      n = (19140 + (Z << 2)) | 0
                      do
                        if ((c[n >> 2] | 0) != (ia | 0)) {
                          ea = (fa + 16) | 0
                          c[
                            ((c[ea >> 2] | 0) == (ia | 0)
                              ? ea
                              : (fa + 20) | 0) >> 2
                          ] = ra
                          if (!ra) break h
                        } else {
                          c[n >> 2] = ra
                          if (ra | 0) break
                          c[4710] = c[4710] & ~(1 << Z)
                          break h
                        }
                      while (0)
                      c[(ra + 24) >> 2] = fa
                      Z = (ia + 16) | 0
                      n = c[Z >> 2] | 0
                      if (n | 0) {
                        c[(ra + 16) >> 2] = n
                        c[(n + 24) >> 2] = ra
                      }
                      n = c[(Z + 4) >> 2] | 0
                      if (!n) break
                      c[(ra + 20) >> 2] = n
                      c[(n + 24) >> 2] = ra
                    }
                  while (0)
                  wa = (ia + ha) | 0
                  xa = (ha + d) | 0
                } else {
                  wa = ia
                  xa = d
                }
                ga = (wa + 4) | 0
                c[ga >> 2] = c[ga >> 2] & -2
                c[(oa + 4) >> 2] = xa | 1
                c[(oa + xa) >> 2] = xa
                ga = xa >>> 3
                if (xa >>> 0 < 256) {
                  X = (18876 + ((ga << 1) << 2)) | 0
                  da = c[4709] | 0
                  n = 1 << ga
                  if (!(da & n)) {
                    c[4709] = da | n
                    ya = X
                    za = (X + 8) | 0
                  } else {
                    n = (X + 8) | 0
                    ya = c[n >> 2] | 0
                    za = n
                  }
                  c[za >> 2] = oa
                  c[(ya + 12) >> 2] = oa
                  c[(oa + 8) >> 2] = ya
                  c[(oa + 12) >> 2] = X
                  break
                }
                X = xa >>> 8
                do
                  if (!X) Aa = 0
                  else {
                    if (xa >>> 0 > 16777215) {
                      Aa = 31
                      break
                    }
                    n = (((X + 1048320) | 0) >>> 16) & 8
                    da = X << n
                    ga = (((da + 520192) | 0) >>> 16) & 4
                    Z = da << ga
                    da = (((Z + 245760) | 0) >>> 16) & 2
                    ea = (14 - (ga | n | da) + ((Z << da) >>> 15)) | 0
                    Aa = ((xa >>> ((ea + 7) | 0)) & 1) | (ea << 1)
                  }
                while (0)
                X = (19140 + (Aa << 2)) | 0
                c[(oa + 28) >> 2] = Aa
                ha = (oa + 16) | 0
                c[(ha + 4) >> 2] = 0
                c[ha >> 2] = 0
                ha = c[4710] | 0
                ea = 1 << Aa
                if (!(ha & ea)) {
                  c[4710] = ha | ea
                  c[X >> 2] = oa
                  c[(oa + 24) >> 2] = X
                  c[(oa + 12) >> 2] = oa
                  c[(oa + 8) >> 2] = oa
                  break
                }
                ea = c[X >> 2] | 0
                i: do
                  if (((c[(ea + 4) >> 2] & -8) | 0) == (xa | 0)) Ba = ea
                  else {
                    X = xa << ((Aa | 0) == 31 ? 0 : (25 - (Aa >>> 1)) | 0)
                    ha = ea
                    while (1) {
                      Ca = (ha + 16 + ((X >>> 31) << 2)) | 0
                      da = c[Ca >> 2] | 0
                      if (!da) break
                      if (((c[(da + 4) >> 2] & -8) | 0) == (xa | 0)) {
                        Ba = da
                        break i
                      } else {
                        X = X << 1
                        ha = da
                      }
                    }
                    c[Ca >> 2] = oa
                    c[(oa + 24) >> 2] = ha
                    c[(oa + 12) >> 2] = oa
                    c[(oa + 8) >> 2] = oa
                    break g
                  }
                while (0)
                ea = (Ba + 8) | 0
                X = c[ea >> 2] | 0
                c[(X + 12) >> 2] = oa
                c[ea >> 2] = oa
                c[(oa + 8) >> 2] = X
                c[(oa + 12) >> 2] = Ba
                c[(oa + 24) >> 2] = 0
              }
            while (0)
            o = (na + 8) | 0
            eb = b
            return o | 0
          }
          oa = 19284
          while (1) {
            d = c[oa >> 2] | 0
            if (
              d >>> 0 <= ja >>> 0
                ? ((Da = (d + (c[(oa + 4) >> 2] | 0)) | 0), Da >>> 0 > ja >>> 0)
                : 0
            )
              break
            oa = c[(oa + 8) >> 2] | 0
          }
          oa = (Da + -47) | 0
          na = (oa + 8) | 0
          d = (oa + (((na & 7) | 0) == 0 ? 0 : (0 - na) & 7)) | 0
          na = (ja + 16) | 0
          oa = d >>> 0 < na >>> 0 ? ja : d
          d = (oa + 8) | 0
          ia = (ka + -40) | 0
          ma = (la + 8) | 0
          W = ((ma & 7) | 0) == 0 ? 0 : (0 - ma) & 7
          ma = (la + W) | 0
          X = (ia - W) | 0
          c[4715] = ma
          c[4712] = X
          c[(ma + 4) >> 2] = X | 1
          c[(la + ia + 4) >> 2] = 40
          c[4716] = c[4831]
          ia = (oa + 4) | 0
          c[ia >> 2] = 27
          c[d >> 2] = c[4821]
          c[(d + 4) >> 2] = c[4822]
          c[(d + 8) >> 2] = c[4823]
          c[(d + 12) >> 2] = c[4824]
          c[4821] = la
          c[4822] = ka
          c[4824] = 0
          c[4823] = d
          d = (oa + 24) | 0
          do {
            X = d
            d = (d + 4) | 0
            c[d >> 2] = 7
          } while (((X + 8) | 0) >>> 0 < Da >>> 0)
          if ((oa | 0) != (ja | 0)) {
            d = (oa - ja) | 0
            c[ia >> 2] = c[ia >> 2] & -2
            c[(ja + 4) >> 2] = d | 1
            c[oa >> 2] = d
            X = d >>> 3
            if (d >>> 0 < 256) {
              ma = (18876 + ((X << 1) << 2)) | 0
              W = c[4709] | 0
              ea = 1 << X
              if (!(W & ea)) {
                c[4709] = W | ea
                Ea = ma
                Fa = (ma + 8) | 0
              } else {
                ea = (ma + 8) | 0
                Ea = c[ea >> 2] | 0
                Fa = ea
              }
              c[Fa >> 2] = ja
              c[(Ea + 12) >> 2] = ja
              c[(ja + 8) >> 2] = Ea
              c[(ja + 12) >> 2] = ma
              break
            }
            ma = d >>> 8
            if (ma)
              if (d >>> 0 > 16777215) Ga = 31
              else {
                ea = (((ma + 1048320) | 0) >>> 16) & 8
                W = ma << ea
                ma = (((W + 520192) | 0) >>> 16) & 4
                X = W << ma
                W = (((X + 245760) | 0) >>> 16) & 2
                fa = (14 - (ma | ea | W) + ((X << W) >>> 15)) | 0
                Ga = ((d >>> ((fa + 7) | 0)) & 1) | (fa << 1)
              }
            else Ga = 0
            fa = (19140 + (Ga << 2)) | 0
            c[(ja + 28) >> 2] = Ga
            c[(ja + 20) >> 2] = 0
            c[na >> 2] = 0
            W = c[4710] | 0
            X = 1 << Ga
            if (!(W & X)) {
              c[4710] = W | X
              c[fa >> 2] = ja
              c[(ja + 24) >> 2] = fa
              c[(ja + 12) >> 2] = ja
              c[(ja + 8) >> 2] = ja
              break
            }
            X = c[fa >> 2] | 0
            j: do
              if (((c[(X + 4) >> 2] & -8) | 0) == (d | 0)) Ha = X
              else {
                fa = d << ((Ga | 0) == 31 ? 0 : (25 - (Ga >>> 1)) | 0)
                W = X
                while (1) {
                  Ia = (W + 16 + ((fa >>> 31) << 2)) | 0
                  ea = c[Ia >> 2] | 0
                  if (!ea) break
                  if (((c[(ea + 4) >> 2] & -8) | 0) == (d | 0)) {
                    Ha = ea
                    break j
                  } else {
                    fa = fa << 1
                    W = ea
                  }
                }
                c[Ia >> 2] = ja
                c[(ja + 24) >> 2] = W
                c[(ja + 12) >> 2] = ja
                c[(ja + 8) >> 2] = ja
                break f
              }
            while (0)
            d = (Ha + 8) | 0
            X = c[d >> 2] | 0
            c[(X + 12) >> 2] = ja
            c[d >> 2] = ja
            c[(ja + 8) >> 2] = X
            c[(ja + 12) >> 2] = Ha
            c[(ja + 24) >> 2] = 0
          }
        } else {
          X = c[4713] | 0
          if (((X | 0) == 0) | (la >>> 0 < X >>> 0)) c[4713] = la
          c[4821] = la
          c[4822] = ka
          c[4824] = 0
          c[4718] = c[4827]
          c[4717] = -1
          c[4722] = 18876
          c[4721] = 18876
          c[4724] = 18884
          c[4723] = 18884
          c[4726] = 18892
          c[4725] = 18892
          c[4728] = 18900
          c[4727] = 18900
          c[4730] = 18908
          c[4729] = 18908
          c[4732] = 18916
          c[4731] = 18916
          c[4734] = 18924
          c[4733] = 18924
          c[4736] = 18932
          c[4735] = 18932
          c[4738] = 18940
          c[4737] = 18940
          c[4740] = 18948
          c[4739] = 18948
          c[4742] = 18956
          c[4741] = 18956
          c[4744] = 18964
          c[4743] = 18964
          c[4746] = 18972
          c[4745] = 18972
          c[4748] = 18980
          c[4747] = 18980
          c[4750] = 18988
          c[4749] = 18988
          c[4752] = 18996
          c[4751] = 18996
          c[4754] = 19004
          c[4753] = 19004
          c[4756] = 19012
          c[4755] = 19012
          c[4758] = 19020
          c[4757] = 19020
          c[4760] = 19028
          c[4759] = 19028
          c[4762] = 19036
          c[4761] = 19036
          c[4764] = 19044
          c[4763] = 19044
          c[4766] = 19052
          c[4765] = 19052
          c[4768] = 19060
          c[4767] = 19060
          c[4770] = 19068
          c[4769] = 19068
          c[4772] = 19076
          c[4771] = 19076
          c[4774] = 19084
          c[4773] = 19084
          c[4776] = 19092
          c[4775] = 19092
          c[4778] = 19100
          c[4777] = 19100
          c[4780] = 19108
          c[4779] = 19108
          c[4782] = 19116
          c[4781] = 19116
          c[4784] = 19124
          c[4783] = 19124
          X = (ka + -40) | 0
          d = (la + 8) | 0
          na = ((d & 7) | 0) == 0 ? 0 : (0 - d) & 7
          d = (la + na) | 0
          oa = (X - na) | 0
          c[4715] = d
          c[4712] = oa
          c[(d + 4) >> 2] = oa | 1
          c[(la + X + 4) >> 2] = 40
          c[4716] = c[4831]
        }
      while (0)
      la = c[4712] | 0
      if (la >>> 0 > F >>> 0) {
        ka = (la - F) | 0
        c[4712] = ka
        la = c[4715] | 0
        ja = (la + F) | 0
        c[4715] = ja
        c[(ja + 4) >> 2] = ka | 1
        c[(la + 4) >> 2] = F | 3
        o = (la + 8) | 0
        eb = b
        return o | 0
      }
    }
    c[(Cg() | 0) >> 2] = 12
    o = 0
    eb = b
    return o | 0
  }
  function gh(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0,
      I = 0
    if (!a) return
    b = (a + -8) | 0
    d = c[4713] | 0
    e = c[(a + -4) >> 2] | 0
    a = e & -8
    f = (b + a) | 0
    do
      if (!(e & 1)) {
        g = c[b >> 2] | 0
        if (!(e & 3)) return
        h = (b + (0 - g)) | 0
        i = (g + a) | 0
        if (h >>> 0 < d >>> 0) return
        if ((c[4714] | 0) == (h | 0)) {
          j = (f + 4) | 0
          k = c[j >> 2] | 0
          if (((k & 3) | 0) != 3) {
            l = h
            m = i
            n = h
            break
          }
          c[4711] = i
          c[j >> 2] = k & -2
          c[(h + 4) >> 2] = i | 1
          c[(h + i) >> 2] = i
          return
        }
        k = g >>> 3
        if (g >>> 0 < 256) {
          g = c[(h + 8) >> 2] | 0
          j = c[(h + 12) >> 2] | 0
          if ((j | 0) == (g | 0)) {
            c[4709] = c[4709] & ~(1 << k)
            l = h
            m = i
            n = h
            break
          } else {
            c[(g + 12) >> 2] = j
            c[(j + 8) >> 2] = g
            l = h
            m = i
            n = h
            break
          }
        }
        g = c[(h + 24) >> 2] | 0
        j = c[(h + 12) >> 2] | 0
        do
          if ((j | 0) == (h | 0)) {
            k = (h + 16) | 0
            o = (k + 4) | 0
            p = c[o >> 2] | 0
            if (!p) {
              q = c[k >> 2] | 0
              if (!q) {
                r = 0
                break
              } else {
                s = q
                t = k
              }
            } else {
              s = p
              t = o
            }
            o = s
            p = t
            while (1) {
              k = (o + 20) | 0
              q = c[k >> 2] | 0
              if (!q) {
                u = (o + 16) | 0
                v = c[u >> 2] | 0
                if (!v) break
                else {
                  w = v
                  x = u
                }
              } else {
                w = q
                x = k
              }
              o = w
              p = x
            }
            c[p >> 2] = 0
            r = o
          } else {
            k = c[(h + 8) >> 2] | 0
            c[(k + 12) >> 2] = j
            c[(j + 8) >> 2] = k
            r = j
          }
        while (0)
        if (g) {
          j = c[(h + 28) >> 2] | 0
          k = (19140 + (j << 2)) | 0
          if ((c[k >> 2] | 0) == (h | 0)) {
            c[k >> 2] = r
            if (!r) {
              c[4710] = c[4710] & ~(1 << j)
              l = h
              m = i
              n = h
              break
            }
          } else {
            j = (g + 16) | 0
            c[((c[j >> 2] | 0) == (h | 0) ? j : (g + 20) | 0) >> 2] = r
            if (!r) {
              l = h
              m = i
              n = h
              break
            }
          }
          c[(r + 24) >> 2] = g
          j = (h + 16) | 0
          k = c[j >> 2] | 0
          if (k | 0) {
            c[(r + 16) >> 2] = k
            c[(k + 24) >> 2] = r
          }
          k = c[(j + 4) >> 2] | 0
          if (k) {
            c[(r + 20) >> 2] = k
            c[(k + 24) >> 2] = r
            l = h
            m = i
            n = h
          } else {
            l = h
            m = i
            n = h
          }
        } else {
          l = h
          m = i
          n = h
        }
      } else {
        l = b
        m = a
        n = b
      }
    while (0)
    if (n >>> 0 >= f >>> 0) return
    b = (f + 4) | 0
    a = c[b >> 2] | 0
    if (!(a & 1)) return
    if (!(a & 2)) {
      if ((c[4715] | 0) == (f | 0)) {
        r = ((c[4712] | 0) + m) | 0
        c[4712] = r
        c[4715] = l
        c[(l + 4) >> 2] = r | 1
        if ((l | 0) != (c[4714] | 0)) return
        c[4714] = 0
        c[4711] = 0
        return
      }
      if ((c[4714] | 0) == (f | 0)) {
        r = ((c[4711] | 0) + m) | 0
        c[4711] = r
        c[4714] = n
        c[(l + 4) >> 2] = r | 1
        c[(n + r) >> 2] = r
        return
      }
      r = ((a & -8) + m) | 0
      x = a >>> 3
      do
        if (a >>> 0 < 256) {
          w = c[(f + 8) >> 2] | 0
          t = c[(f + 12) >> 2] | 0
          if ((t | 0) == (w | 0)) {
            c[4709] = c[4709] & ~(1 << x)
            break
          } else {
            c[(w + 12) >> 2] = t
            c[(t + 8) >> 2] = w
            break
          }
        } else {
          w = c[(f + 24) >> 2] | 0
          t = c[(f + 12) >> 2] | 0
          do
            if ((t | 0) == (f | 0)) {
              s = (f + 16) | 0
              d = (s + 4) | 0
              e = c[d >> 2] | 0
              if (!e) {
                k = c[s >> 2] | 0
                if (!k) {
                  y = 0
                  break
                } else {
                  z = k
                  A = s
                }
              } else {
                z = e
                A = d
              }
              d = z
              e = A
              while (1) {
                s = (d + 20) | 0
                k = c[s >> 2] | 0
                if (!k) {
                  j = (d + 16) | 0
                  q = c[j >> 2] | 0
                  if (!q) break
                  else {
                    B = q
                    C = j
                  }
                } else {
                  B = k
                  C = s
                }
                d = B
                e = C
              }
              c[e >> 2] = 0
              y = d
            } else {
              o = c[(f + 8) >> 2] | 0
              c[(o + 12) >> 2] = t
              c[(t + 8) >> 2] = o
              y = t
            }
          while (0)
          if (w | 0) {
            t = c[(f + 28) >> 2] | 0
            h = (19140 + (t << 2)) | 0
            if ((c[h >> 2] | 0) == (f | 0)) {
              c[h >> 2] = y
              if (!y) {
                c[4710] = c[4710] & ~(1 << t)
                break
              }
            } else {
              t = (w + 16) | 0
              c[((c[t >> 2] | 0) == (f | 0) ? t : (w + 20) | 0) >> 2] = y
              if (!y) break
            }
            c[(y + 24) >> 2] = w
            t = (f + 16) | 0
            h = c[t >> 2] | 0
            if (h | 0) {
              c[(y + 16) >> 2] = h
              c[(h + 24) >> 2] = y
            }
            h = c[(t + 4) >> 2] | 0
            if (h | 0) {
              c[(y + 20) >> 2] = h
              c[(h + 24) >> 2] = y
            }
          }
        }
      while (0)
      c[(l + 4) >> 2] = r | 1
      c[(n + r) >> 2] = r
      if ((l | 0) == (c[4714] | 0)) {
        c[4711] = r
        return
      } else D = r
    } else {
      c[b >> 2] = a & -2
      c[(l + 4) >> 2] = m | 1
      c[(n + m) >> 2] = m
      D = m
    }
    m = D >>> 3
    if (D >>> 0 < 256) {
      n = (18876 + ((m << 1) << 2)) | 0
      a = c[4709] | 0
      b = 1 << m
      if (!(a & b)) {
        c[4709] = a | b
        E = n
        F = (n + 8) | 0
      } else {
        b = (n + 8) | 0
        E = c[b >> 2] | 0
        F = b
      }
      c[F >> 2] = l
      c[(E + 12) >> 2] = l
      c[(l + 8) >> 2] = E
      c[(l + 12) >> 2] = n
      return
    }
    n = D >>> 8
    if (n)
      if (D >>> 0 > 16777215) G = 31
      else {
        E = (((n + 1048320) | 0) >>> 16) & 8
        F = n << E
        n = (((F + 520192) | 0) >>> 16) & 4
        b = F << n
        F = (((b + 245760) | 0) >>> 16) & 2
        a = (14 - (n | E | F) + ((b << F) >>> 15)) | 0
        G = ((D >>> ((a + 7) | 0)) & 1) | (a << 1)
      }
    else G = 0
    a = (19140 + (G << 2)) | 0
    c[(l + 28) >> 2] = G
    c[(l + 20) >> 2] = 0
    c[(l + 16) >> 2] = 0
    F = c[4710] | 0
    b = 1 << G
    a: do
      if (!(F & b)) {
        c[4710] = F | b
        c[a >> 2] = l
        c[(l + 24) >> 2] = a
        c[(l + 12) >> 2] = l
        c[(l + 8) >> 2] = l
      } else {
        E = c[a >> 2] | 0
        b: do
          if (((c[(E + 4) >> 2] & -8) | 0) == (D | 0)) H = E
          else {
            n = D << ((G | 0) == 31 ? 0 : (25 - (G >>> 1)) | 0)
            m = E
            while (1) {
              I = (m + 16 + ((n >>> 31) << 2)) | 0
              r = c[I >> 2] | 0
              if (!r) break
              if (((c[(r + 4) >> 2] & -8) | 0) == (D | 0)) {
                H = r
                break b
              } else {
                n = n << 1
                m = r
              }
            }
            c[I >> 2] = l
            c[(l + 24) >> 2] = m
            c[(l + 12) >> 2] = l
            c[(l + 8) >> 2] = l
            break a
          }
        while (0)
        E = (H + 8) | 0
        w = c[E >> 2] | 0
        c[(w + 12) >> 2] = l
        c[E >> 2] = l
        c[(l + 8) >> 2] = w
        c[(l + 12) >> 2] = H
        c[(l + 24) >> 2] = 0
      }
    while (0)
    l = ((c[4717] | 0) + -1) | 0
    c[4717] = l
    if (l | 0) return
    l = 19292
    while (1) {
      H = c[l >> 2] | 0
      if (!H) break
      else l = (H + 8) | 0
    }
    c[4717] = -1
    return
  }
  function hh(a) {
    a = a | 0
    return 0
  }
  function ih(a) {
    a = a | 0
    return 0
  }
  function jh(a, b) {
    a = a | 0
    b = b | 0
    var d = 0
    if (!a) {
      d = 22
      return d | 0
    }
    b = fh(8) | 0
    c[b >> 2] = 0
    c[(b + 4) >> 2] = 38177486
    c[a >> 2] = b
    d = 0
    return d | 0
  }
  function kh(a) {
    a = a | 0
    var b = 0
    if ((c[(a + 4) >> 2] | 0) != 38177486) {
      b = 0
      return b | 0
    }
    b = c[a >> 2] | 0
    return b | 0
  }
  function lh(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0
    d = a
    if ((c[(d + 4) >> 2] | 0) != 38177486) {
      e = 22
      return e | 0
    }
    c[d >> 2] = b
    e = 0
    return e | 0
  }
  function mh(a, b) {
    a = a | 0
    b = b | 0
    if ((c[a >> 2] | 0) == 324508639) return 0
    nb[b & 3]()
    c[a >> 2] = 324508639
    return 0
  }
  function nh() {
    return ((oh() | 0) > 0) | 0
  }
  function oh() {
    return ((L() | 0) & 1) | 0
  }
  function ph(a) {
    a = a | 0
    return
  }
  function qh(a) {
    a = a | 0
    ph(a)
    yh(a)
    return
  }
  function rh(a) {
    a = a | 0
    return 17855
  }
  function sh(a) {
    a = a | 0
    return
  }
  function th(a) {
    a = a | 0
    var b = 0,
      d = 0
    b = (a + 8) | 0
    if (
      !((c[b >> 2] | 0) != 0
        ? ((d = c[b >> 2] | 0), (c[b >> 2] = d + -1), (d | 0) != 0)
        : 0)
    )
      ob[c[((c[a >> 2] | 0) + 16) >> 2] & 255](a)
    return
  }
  function uh(a) {
    a = a | 0
    var b = 0
    b = hh(a) | 0
    if (!b) return
    else Ih(b, 17961)
  }
  function vh(a) {
    a = a | 0
    ih(a) | 0
    return
  }
  function wh(a) {
    a = a | 0
    var b = 0,
      c = 0
    b = (a | 0) == 0 ? 1 : a
    while (1) {
      a = fh(b) | 0
      if (a | 0) {
        c = a
        break
      }
      a = Hi() | 0
      if (!a) {
        c = 0
        break
      }
      nb[a & 3]()
    }
    return c | 0
  }
  function xh(a) {
    a = a | 0
    return wh(a) | 0
  }
  function yh(a) {
    a = a | 0
    gh(a)
    return
  }
  function zh(a) {
    a = a | 0
    yh(a)
    return
  }
  function Ah(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0,
      f = 0
    d = bh(b) | 0
    e = wh((d + 13) | 0) | 0
    c[e >> 2] = d
    c[(e + 4) >> 2] = d
    c[(e + 8) >> 2] = 0
    f = Bh(e) | 0
    Ti(f | 0, b | 0, (d + 1) | 0) | 0
    c[a >> 2] = f
    return
  }
  function Bh(a) {
    a = a | 0
    return (a + 12) | 0
  }
  function Ch(a, b) {
    a = a | 0
    b = b | 0
    c[a >> 2] = 3804
    Ah((a + 4) | 0, b)
    return
  }
  function Dh(a) {
    a = a | 0
    return 1
  }
  function Eh(a, b) {
    a = a | 0
    b = b | 0
    c[a >> 2] = 3824
    Ah((a + 4) | 0, b)
    return
  }
  function Fh(a) {
    a = a | 0
    ea()
  }
  function Gh(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    var d = 0
    if (!c) d = 0
    else d = Eg(a, b, c) | 0
    return d | 0
  }
  function Hh(b, d, e, f, g) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0,
      i = 0,
      j = 0,
      k = 0
    h = a[(b + 11) >> 0] | 0
    i = (h << 24) >> 24 < 0
    if (i) j = c[(b + 4) >> 2] | 0
    else j = h & 255
    if (((g | 0) == -1) | (j >>> 0 < d >>> 0)) Fh(b)
    h = (j - d) | 0
    j = h >>> 0 < e >>> 0 ? h : e
    if (i) k = c[b >> 2] | 0
    else k = b
    b = j >>> 0 > g >>> 0
    i = Gh((k + d) | 0, f, b ? g : j) | 0
    if (!i) return (j >>> 0 < g >>> 0 ? -1 : b & 1) | 0
    else return i | 0
    return 0
  }
  function Ih(a, b) {
    a = a | 0
    b = b | 0
    ea()
  }
  function Jh(a) {
    a = a | 0
    ea()
  }
  function Kh() {
    var a = 0,
      b = 0,
      d = 0,
      e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0
    a = eb
    eb = (eb + 48) | 0
    b = (a + 32) | 0
    d = (a + 24) | 0
    e = (a + 16) | 0
    f = a
    g = (a + 36) | 0
    a = Lh() | 0
    if (a | 0 ? ((h = c[a >> 2] | 0), h | 0) : 0) {
      a = (h + 48) | 0
      i = c[a >> 2] | 0
      j = c[(a + 4) >> 2] | 0
      if (!((((i & -256) | 0) == 1126902528) & ((j | 0) == 1129074247))) {
        c[d >> 2] = 18115
        Mh(18065, d)
      }
      if (((i | 0) == 1126902529) & ((j | 0) == 1129074247))
        k = c[(h + 44) >> 2] | 0
      else k = (h + 80) | 0
      c[g >> 2] = k
      k = c[h >> 2] | 0
      h = c[(k + 4) >> 2] | 0
      if (lb[c[((c[478] | 0) + 16) >> 2] & 7](1912, k, g) | 0) {
        k = c[g >> 2] | 0
        g = ib[c[((c[k >> 2] | 0) + 8) >> 2] & 15](k) | 0
        c[f >> 2] = 18115
        c[(f + 4) >> 2] = h
        c[(f + 8) >> 2] = g
        Mh(17979, f)
      } else {
        c[e >> 2] = 18115
        c[(e + 4) >> 2] = h
        Mh(18024, e)
      }
    }
    Mh(18103, b)
  }
  function Lh() {
    var a = 0,
      b = 0
    a = eb
    eb = (eb + 16) | 0
    if (!(mh(19332, 2) | 0)) {
      b = kh(c[4834] | 0) | 0
      eb = a
      return b | 0
    } else Mh(18254, a)
    return 0
  }
  function Mh(a, b) {
    a = a | 0
    b = b | 0
    var d = 0,
      e = 0
    d = eb
    eb = (eb + 16) | 0
    e = d
    c[e >> 2] = b
    b = c[861] | 0
    Gg(b, a, e) | 0
    eh(10, b) | 0
    ea()
  }
  function Nh(a) {
    a = a | 0
    return
  }
  function Oh(a) {
    a = a | 0
    Nh(a)
    yh(a)
    return
  }
  function Ph(a) {
    a = a | 0
    return
  }
  function Qh(a) {
    a = a | 0
    return
  }
  function Rh(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    e = eb
    eb = (eb + 64) | 0
    f = e
    if (!(Vh(a, b, 0) | 0))
      if ((b | 0) != 0 ? ((g = Zh(b, 1936, 1920, 0) | 0), (g | 0) != 0) : 0) {
        b = (f + 4) | 0
        h = (b + 52) | 0
        do {
          c[b >> 2] = 0
          b = (b + 4) | 0
        } while ((b | 0) < (h | 0))
        c[f >> 2] = g
        c[(f + 8) >> 2] = a
        c[(f + 12) >> 2] = -1
        c[(f + 48) >> 2] = 1
        rb[c[((c[g >> 2] | 0) + 28) >> 2] & 7](g, f, c[d >> 2] | 0, 1)
        if ((c[(f + 24) >> 2] | 0) == 1) {
          c[d >> 2] = c[(f + 16) >> 2]
          i = 1
        } else i = 0
        j = i
      } else j = 0
    else j = 1
    eb = e
    return j | 0
  }
  function Sh(a, b, d, e, f, g) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    if (Vh(a, c[(b + 8) >> 2] | 0, g) | 0) Yh(0, b, d, e, f)
    return
  }
  function Th(b, d, e, f, g) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0
    do
      if (!(Vh(b, c[(d + 8) >> 2] | 0, g) | 0)) {
        if (Vh(b, c[d >> 2] | 0, g) | 0) {
          if (
            (c[(d + 16) >> 2] | 0) != (e | 0)
              ? ((h = (d + 20) | 0), (c[h >> 2] | 0) != (e | 0))
              : 0
          ) {
            c[(d + 32) >> 2] = f
            c[h >> 2] = e
            h = (d + 40) | 0
            c[h >> 2] = (c[h >> 2] | 0) + 1
            if ((c[(d + 36) >> 2] | 0) == 1 ? (c[(d + 24) >> 2] | 0) == 2 : 0)
              a[(d + 54) >> 0] = 1
            c[(d + 44) >> 2] = 4
            break
          }
          if ((f | 0) == 1) c[(d + 32) >> 2] = 1
        }
      } else Xh(0, d, e, f)
    while (0)
    return
  }
  function Uh(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    if (Vh(a, c[(b + 8) >> 2] | 0, 0) | 0) Wh(0, b, d, e)
    return
  }
  function Vh(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    return ((a | 0) == (b | 0)) | 0
  }
  function Wh(b, d, e, f) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0
    b = (d + 16) | 0
    g = c[b >> 2] | 0
    do
      if (g) {
        if ((g | 0) != (e | 0)) {
          h = (d + 36) | 0
          c[h >> 2] = (c[h >> 2] | 0) + 1
          c[(d + 24) >> 2] = 2
          a[(d + 54) >> 0] = 1
          break
        }
        h = (d + 24) | 0
        if ((c[h >> 2] | 0) == 2) c[h >> 2] = f
      } else {
        c[b >> 2] = e
        c[(d + 24) >> 2] = f
        c[(d + 36) >> 2] = 1
      }
    while (0)
    return
  }
  function Xh(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    if (
      (c[(b + 4) >> 2] | 0) == (d | 0)
        ? ((d = (b + 28) | 0), (c[d >> 2] | 0) != 1)
        : 0
    )
      c[d >> 2] = e
    return
  }
  function Yh(b, d, e, f, g) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0,
      i = 0
    a[(d + 53) >> 0] = 1
    do
      if ((c[(d + 4) >> 2] | 0) == (f | 0)) {
        a[(d + 52) >> 0] = 1
        b = (d + 16) | 0
        h = c[b >> 2] | 0
        if (!h) {
          c[b >> 2] = e
          c[(d + 24) >> 2] = g
          c[(d + 36) >> 2] = 1
          if (!((g | 0) == 1 ? (c[(d + 48) >> 2] | 0) == 1 : 0)) break
          a[(d + 54) >> 0] = 1
          break
        }
        if ((h | 0) != (e | 0)) {
          h = (d + 36) | 0
          c[h >> 2] = (c[h >> 2] | 0) + 1
          a[(d + 54) >> 0] = 1
          break
        }
        h = (d + 24) | 0
        b = c[h >> 2] | 0
        if ((b | 0) == 2) {
          c[h >> 2] = g
          i = g
        } else i = b
        if ((i | 0) == 1 ? (c[(d + 48) >> 2] | 0) == 1 : 0) a[(d + 54) >> 0] = 1
      }
    while (0)
    return
  }
  function Zh(d, e, f, g) {
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0
    h = eb
    eb = (eb + 64) | 0
    i = h
    j = c[d >> 2] | 0
    k = (d + (c[(j + -8) >> 2] | 0)) | 0
    l = c[(j + -4) >> 2] | 0
    c[i >> 2] = f
    c[(i + 4) >> 2] = d
    c[(i + 8) >> 2] = e
    c[(i + 12) >> 2] = g
    g = (i + 16) | 0
    e = (i + 20) | 0
    d = (i + 24) | 0
    j = (i + 28) | 0
    m = (i + 32) | 0
    n = (i + 40) | 0
    o = g
    p = (o + 36) | 0
    do {
      c[o >> 2] = 0
      o = (o + 4) | 0
    } while ((o | 0) < (p | 0))
    b[(g + 36) >> 1] = 0
    a[(g + 38) >> 0] = 0
    a: do
      if (Vh(l, f, 0) | 0) {
        c[(i + 48) >> 2] = 1
        tb[c[((c[l >> 2] | 0) + 20) >> 2] & 3](l, i, k, k, 1, 0)
        q = (c[d >> 2] | 0) == 1 ? k : 0
      } else {
        sb[c[((c[l >> 2] | 0) + 24) >> 2] & 3](l, i, k, 1, 0)
        switch (c[(i + 36) >> 2] | 0) {
          case 0: {
            q =
              ((c[n >> 2] | 0) == 1) &
              ((c[j >> 2] | 0) == 1) &
              ((c[m >> 2] | 0) == 1)
                ? c[e >> 2] | 0
                : 0
            break a
            break
          }
          case 1:
            break
          default: {
            q = 0
            break a
          }
        }
        if (
          (c[d >> 2] | 0) != 1
            ? !(
                ((c[n >> 2] | 0) == 0) &
                ((c[j >> 2] | 0) == 1) &
                ((c[m >> 2] | 0) == 1)
              )
            : 0
        ) {
          q = 0
          break
        }
        q = c[g >> 2] | 0
      }
    while (0)
    eb = h
    return q | 0
  }
  function _h(a) {
    a = a | 0
    Nh(a)
    yh(a)
    return
  }
  function $h(a, b, d, e, f, g) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0
    if (Vh(a, c[(b + 8) >> 2] | 0, g) | 0) Yh(0, b, d, e, f)
    else {
      h = c[(a + 8) >> 2] | 0
      tb[c[((c[h >> 2] | 0) + 20) >> 2] & 3](h, b, d, e, f, g)
    }
    return
  }
  function ai(b, d, e, f, g) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0
    do
      if (!(Vh(b, c[(d + 8) >> 2] | 0, g) | 0)) {
        if (!(Vh(b, c[d >> 2] | 0, g) | 0)) {
          h = c[(b + 8) >> 2] | 0
          sb[c[((c[h >> 2] | 0) + 24) >> 2] & 3](h, d, e, f, g)
          break
        }
        if (
          (c[(d + 16) >> 2] | 0) != (e | 0)
            ? ((h = (d + 20) | 0), (c[h >> 2] | 0) != (e | 0))
            : 0
        ) {
          c[(d + 32) >> 2] = f
          i = (d + 44) | 0
          if ((c[i >> 2] | 0) == 4) break
          j = (d + 52) | 0
          a[j >> 0] = 0
          k = (d + 53) | 0
          a[k >> 0] = 0
          l = c[(b + 8) >> 2] | 0
          tb[c[((c[l >> 2] | 0) + 20) >> 2] & 3](l, d, e, e, 1, g)
          if (a[k >> 0] | 0)
            if (!(a[j >> 0] | 0)) {
              m = 1
              n = 11
            } else n = 15
          else {
            m = 0
            n = 11
          }
          do
            if ((n | 0) == 11) {
              c[h >> 2] = e
              j = (d + 40) | 0
              c[j >> 2] = (c[j >> 2] | 0) + 1
              if (
                (c[(d + 36) >> 2] | 0) == 1 ? (c[(d + 24) >> 2] | 0) == 2 : 0
              ) {
                a[(d + 54) >> 0] = 1
                if (m) {
                  n = 15
                  break
                } else {
                  o = 4
                  break
                }
              }
              if (m) n = 15
              else o = 4
            }
          while (0)
          if ((n | 0) == 15) o = 3
          c[i >> 2] = o
          break
        }
        if ((f | 0) == 1) c[(d + 32) >> 2] = 1
      } else Xh(0, d, e, f)
    while (0)
    return
  }
  function bi(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0
    if (Vh(a, c[(b + 8) >> 2] | 0, 0) | 0) Wh(0, b, d, e)
    else {
      f = c[(a + 8) >> 2] | 0
      rb[c[((c[f >> 2] | 0) + 28) >> 2] & 7](f, b, d, e)
    }
    return
  }
  function ci(a) {
    a = a | 0
    return
  }
  function di() {
    var a = 0
    a = eb
    eb = (eb + 16) | 0
    if (!(jh(19336, 128) | 0)) {
      eb = a
      return
    } else Mh(18303, a)
  }
  function ei(a) {
    a = a | 0
    var b = 0
    b = eb
    eb = (eb + 16) | 0
    gh(a)
    if (!(lh(c[4834] | 0, 0) | 0)) {
      eb = b
      return
    } else Mh(18353, b)
  }
  function fi() {
    var a = 0,
      b = 0
    a = Lh() | 0
    if (
      (a | 0 ? ((b = c[a >> 2] | 0), b | 0) : 0)
        ? ((a = (b + 48) | 0),
          ((c[a >> 2] & -256) | 0) == 1126902528
            ? (c[(a + 4) >> 2] | 0) == 1129074247
            : 0)
        : 0
    )
      gi(c[(b + 12) >> 2] | 0)
    gi(hi() | 0)
  }
  function gi(a) {
    a = a | 0
    var b = 0
    b = eb
    eb = (eb + 16) | 0
    nb[a & 3]()
    Mh(18406, b)
  }
  function hi() {
    var a = 0
    a = c[928] | 0
    c[928] = a + 0
    return a | 0
  }
  function ii(a) {
    a = a | 0
    return
  }
  function ji(a) {
    a = a | 0
    c[a >> 2] = 3804
    ni((a + 4) | 0)
    return
  }
  function ki(a) {
    a = a | 0
    ji(a)
    yh(a)
    return
  }
  function li(a) {
    a = a | 0
    return mi((a + 4) | 0) | 0
  }
  function mi(a) {
    a = a | 0
    return c[a >> 2] | 0
  }
  function ni(a) {
    a = a | 0
    var b = 0,
      d = 0
    if (
      Dh(a) | 0
        ? ((b = oi(c[a >> 2] | 0) | 0),
          (a = (b + 8) | 0),
          (d = c[a >> 2] | 0),
          (c[a >> 2] = d + -1),
          ((d + -1) | 0) < 0)
        : 0
    )
      yh(b)
    return
  }
  function oi(a) {
    a = a | 0
    return (a + -12) | 0
  }
  function pi(a) {
    a = a | 0
    c[a >> 2] = 3824
    ni((a + 4) | 0)
    return
  }
  function qi(a) {
    a = a | 0
    pi(a)
    yh(a)
    return
  }
  function ri(a) {
    a = a | 0
    return mi((a + 4) | 0) | 0
  }
  function si(a) {
    a = a | 0
    ji(a)
    yh(a)
    return
  }
  function ti(a) {
    a = a | 0
    Nh(a)
    yh(a)
    return
  }
  function ui(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    return Vh(a, b, 0) | 0
  }
  function vi(a) {
    a = a | 0
    Nh(a)
    yh(a)
    return
  }
  function wi(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0,
      h = 0,
      i = 0,
      j = 0
    e = eb
    eb = (eb + 64) | 0
    f = e
    c[d >> 2] = c[c[d >> 2] >> 2]
    if (!(xi(a, b, 0) | 0))
      if (
        ((b | 0) != 0 ? ((g = Zh(b, 1936, 2040, 0) | 0), (g | 0) != 0) : 0)
          ? ((c[(g + 8) >> 2] & ~c[(a + 8) >> 2]) | 0) == 0
          : 0
      ) {
        b = (a + 12) | 0
        a = (g + 12) | 0
        if (
          !(Vh(c[b >> 2] | 0, c[a >> 2] | 0, 0) | 0)
            ? !(Vh(c[b >> 2] | 0, 2072, 0) | 0)
            : 0
        ) {
          g = c[b >> 2] | 0
          if (
            (
              (
                (g | 0) != 0
                  ? ((b = Zh(g, 1936, 1920, 0) | 0), (b | 0) != 0)
                  : 0
              )
                ? ((g = c[a >> 2] | 0), (g | 0) != 0)
                : 0
            )
              ? ((a = Zh(g, 1936, 1920, 0) | 0), (a | 0) != 0)
              : 0
          ) {
            g = (f + 4) | 0
            h = (g + 52) | 0
            do {
              c[g >> 2] = 0
              g = (g + 4) | 0
            } while ((g | 0) < (h | 0))
            c[f >> 2] = a
            c[(f + 8) >> 2] = b
            c[(f + 12) >> 2] = -1
            c[(f + 48) >> 2] = 1
            rb[c[((c[a >> 2] | 0) + 28) >> 2] & 7](a, f, c[d >> 2] | 0, 1)
            if ((c[(f + 24) >> 2] | 0) == 1) {
              c[d >> 2] = c[(f + 16) >> 2]
              i = 1
            } else i = 0
            j = i
          } else j = 0
        } else j = 1
      } else j = 0
    else j = 1
    eb = e
    return j | 0
  }
  function xi(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    var d = 0
    if (Vh(a, b, 0) | 0) d = 1
    else d = Vh(b, 2080, 0) | 0
    return d | 0
  }
  function yi(a) {
    a = a | 0
    Nh(a)
    yh(a)
    return
  }
  function zi(b, d, e, f, g, h) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    h = h | 0
    var i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0
    if (Vh(b, c[(d + 8) >> 2] | 0, h) | 0) Yh(0, d, e, f, g)
    else {
      i = (d + 52) | 0
      j = a[i >> 0] | 0
      k = (d + 53) | 0
      l = a[k >> 0] | 0
      m = c[(b + 12) >> 2] | 0
      n = (b + 16 + (m << 3)) | 0
      a[i >> 0] = 0
      a[k >> 0] = 0
      Di((b + 16) | 0, d, e, f, g, h)
      a: do
        if ((m | 0) > 1) {
          o = (d + 24) | 0
          p = (b + 8) | 0
          q = (d + 54) | 0
          r = (b + 24) | 0
          do {
            if (a[q >> 0] | 0) break a
            if (!(a[i >> 0] | 0)) {
              if (a[k >> 0] | 0 ? ((c[p >> 2] & 1) | 0) == 0 : 0) break a
            } else {
              if ((c[o >> 2] | 0) == 1) break a
              if (!(c[p >> 2] & 2)) break a
            }
            a[i >> 0] = 0
            a[k >> 0] = 0
            Di(r, d, e, f, g, h)
            r = (r + 8) | 0
          } while (r >>> 0 < n >>> 0)
        }
      while (0)
      a[i >> 0] = j
      a[k >> 0] = l
    }
    return
  }
  function Ai(b, d, e, f, g) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0
    a: do
      if (!(Vh(b, c[(d + 8) >> 2] | 0, g) | 0)) {
        if (!(Vh(b, c[d >> 2] | 0, g) | 0)) {
          h = c[(b + 12) >> 2] | 0
          i = (b + 16 + (h << 3)) | 0
          Ei((b + 16) | 0, d, e, f, g)
          j = (b + 24) | 0
          if ((h | 0) <= 1) break
          h = c[(b + 8) >> 2] | 0
          if (
            ((h & 2) | 0) == 0 ? ((k = (d + 36) | 0), (c[k >> 2] | 0) != 1) : 0
          ) {
            if (!(h & 1)) {
              h = (d + 54) | 0
              l = j
              while (1) {
                if (a[h >> 0] | 0) break a
                if ((c[k >> 2] | 0) == 1) break a
                Ei(l, d, e, f, g)
                l = (l + 8) | 0
                if (l >>> 0 >= i >>> 0) break a
              }
            }
            l = (d + 24) | 0
            h = (d + 54) | 0
            m = j
            while (1) {
              if (a[h >> 0] | 0) break a
              if ((c[k >> 2] | 0) == 1 ? (c[l >> 2] | 0) == 1 : 0) break a
              Ei(m, d, e, f, g)
              m = (m + 8) | 0
              if (m >>> 0 >= i >>> 0) break a
            }
          }
          m = (d + 54) | 0
          l = j
          while (1) {
            if (a[m >> 0] | 0) break a
            Ei(l, d, e, f, g)
            l = (l + 8) | 0
            if (l >>> 0 >= i >>> 0) break a
          }
        }
        if (
          (c[(d + 16) >> 2] | 0) != (e | 0)
            ? ((i = (d + 20) | 0), (c[i >> 2] | 0) != (e | 0))
            : 0
        ) {
          c[(d + 32) >> 2] = f
          l = (d + 44) | 0
          if ((c[l >> 2] | 0) == 4) break
          m = (b + 16 + (c[(b + 12) >> 2] << 3)) | 0
          j = (d + 52) | 0
          k = (d + 53) | 0
          h = (d + 54) | 0
          n = (b + 8) | 0
          o = (d + 24) | 0
          p = 0
          q = (b + 16) | 0
          r = 0
          b: while (1) {
            if (q >>> 0 >= m >>> 0) {
              s = p
              t = 18
              break
            }
            a[j >> 0] = 0
            a[k >> 0] = 0
            Di(q, d, e, e, 1, g)
            if (a[h >> 0] | 0) {
              s = p
              t = 18
              break
            }
            do
              if (a[k >> 0] | 0) {
                if (!(a[j >> 0] | 0))
                  if (!(c[n >> 2] & 1)) {
                    s = 1
                    t = 18
                    break b
                  } else {
                    u = 1
                    v = r
                    break
                  }
                if ((c[o >> 2] | 0) == 1) {
                  t = 23
                  break b
                }
                if (!(c[n >> 2] & 2)) {
                  t = 23
                  break b
                } else {
                  u = 1
                  v = 1
                }
              } else {
                u = p
                v = r
              }
            while (0)
            p = u
            q = (q + 8) | 0
            r = v
          }
          do
            if ((t | 0) == 18) {
              if (
                (
                  !r
                    ? ((c[i >> 2] = e),
                      (q = (d + 40) | 0),
                      (c[q >> 2] = (c[q >> 2] | 0) + 1),
                      (c[(d + 36) >> 2] | 0) == 1)
                    : 0
                )
                  ? (c[o >> 2] | 0) == 2
                  : 0
              ) {
                a[h >> 0] = 1
                if (s) {
                  t = 23
                  break
                } else {
                  w = 4
                  break
                }
              }
              if (s) t = 23
              else w = 4
            }
          while (0)
          if ((t | 0) == 23) w = 3
          c[l >> 2] = w
          break
        }
        if ((f | 0) == 1) c[(d + 32) >> 2] = 1
      } else Xh(0, d, e, f)
    while (0)
    return
  }
  function Bi(b, d, e, f) {
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0
    a: do
      if (!(Vh(b, c[(d + 8) >> 2] | 0, 0) | 0)) {
        g = c[(b + 12) >> 2] | 0
        h = (b + 16 + (g << 3)) | 0
        Ci((b + 16) | 0, d, e, f)
        if ((g | 0) > 1) {
          g = (d + 54) | 0
          i = (b + 24) | 0
          do {
            Ci(i, d, e, f)
            if (a[g >> 0] | 0) break a
            i = (i + 8) | 0
          } while (i >>> 0 < h >>> 0)
        }
      } else Wh(0, d, e, f)
    while (0)
    return
  }
  function Ci(a, b, d, e) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0
    f = c[(a + 4) >> 2] | 0
    g = f >> 8
    if (!(f & 1)) h = g
    else h = c[((c[d >> 2] | 0) + g) >> 2] | 0
    g = c[a >> 2] | 0
    rb[c[((c[g >> 2] | 0) + 28) >> 2] & 7](
      g,
      b,
      (d + h) | 0,
      ((f & 2) | 0) == 0 ? 2 : e
    )
    return
  }
  function Di(a, b, d, e, f, g) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    var h = 0,
      i = 0,
      j = 0
    h = c[(a + 4) >> 2] | 0
    i = h >> 8
    if (!(h & 1)) j = i
    else j = c[((c[e >> 2] | 0) + i) >> 2] | 0
    i = c[a >> 2] | 0
    tb[c[((c[i >> 2] | 0) + 20) >> 2] & 3](
      i,
      b,
      d,
      (e + j) | 0,
      ((h & 2) | 0) == 0 ? 2 : f,
      g
    )
    return
  }
  function Ei(a, b, d, e, f) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0
    g = c[(a + 4) >> 2] | 0
    h = g >> 8
    if (!(g & 1)) i = h
    else i = c[((c[d >> 2] | 0) + h) >> 2] | 0
    h = c[a >> 2] | 0
    sb[c[((c[h >> 2] | 0) + 24) >> 2] & 3](
      h,
      b,
      (d + i) | 0,
      ((g & 2) | 0) == 0 ? 2 : e,
      f
    )
    return
  }
  function Fi(b) {
    b = b | 0
    var c = 0
    if ((a[b >> 0] | 0) == 1) c = 0
    else {
      a[b >> 0] = 1
      c = 1
    }
    return c | 0
  }
  function Gi(a) {
    a = a | 0
    return
  }
  function Hi() {
    var a = 0
    a = c[4835] | 0
    c[4835] = a + 0
    return a | 0
  }
  function Ii(a, b, d) {
    a = a | 0
    b = b | 0
    d = d | 0
    var e = 0,
      f = 0,
      g = 0
    e = eb
    eb = (eb + 16) | 0
    f = e
    c[f >> 2] = c[d >> 2]
    g = lb[c[((c[a >> 2] | 0) + 16) >> 2] & 7](a, b, f) | 0
    if (g) c[d >> 2] = c[f >> 2]
    eb = e
    return (g & 1) | 0
  }
  function Ji(a) {
    a = a | 0
    var b = 0
    if (!a) b = 0
    else b = ((Zh(a, 1936, 2040, 0) | 0) != 0) & 1
    return b | 0
  }
  function Ki(a, b) {
    a = a | 0
    b = b | 0
    var c = 0,
      d = 0,
      e = 0,
      f = 0
    c = a & 65535
    d = b & 65535
    e = r(d, c) | 0
    f = a >>> 16
    a = ((e >>> 16) + (r(d, f) | 0)) | 0
    d = b >>> 16
    b = r(d, c) | 0
    return (
      (u(((a >>> 16) + (r(d, f) | 0) + ((((a & 65535) + b) | 0) >>> 16)) | 0),
      ((a + b) << 16) | (e & 65535) | 0) | 0
    )
  }
  function Li(a, b, c, d) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    var e = 0,
      f = 0
    e = a
    a = c
    c = Ki(e, a) | 0
    f = v() | 0
    return (u(((r(b, a) | 0) + (r(d, e) | 0) + f) | (f & 0) | 0), c | 0 | 0) | 0
  }
  function Mi(a, b, c, d) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    var e = 0
    e = (a + c) >>> 0
    return (u(((b + d + ((e >>> 0 < a >>> 0) | 0)) >>> 0) | 0), e | 0) | 0
  }
  function Ni(a, b, c, d) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    var e = 0
    e = (b - d) >>> 0
    e = (b - d - ((c >>> 0 > a >>> 0) | 0)) >>> 0
    return (u(e | 0), ((a - c) >>> 0) | 0) | 0
  }
  function Oi(a) {
    a = a | 0
    return (a ? (31 - (s(a ^ (a - 1)) | 0)) | 0 : 32) | 0
  }
  function Pi(a, b, d, e, f) {
    a = a | 0
    b = b | 0
    d = d | 0
    e = e | 0
    f = f | 0
    var g = 0,
      h = 0,
      i = 0,
      j = 0,
      k = 0,
      l = 0,
      m = 0,
      n = 0,
      o = 0,
      p = 0,
      q = 0,
      r = 0,
      t = 0,
      w = 0,
      x = 0,
      y = 0,
      z = 0,
      A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0,
      I = 0,
      J = 0
    g = a
    h = b
    i = h
    j = d
    k = e
    l = k
    if (!i) {
      m = (f | 0) != 0
      if (!l) {
        if (m) {
          c[f >> 2] = (g >>> 0) % (j >>> 0)
          c[(f + 4) >> 2] = 0
        }
        n = 0
        o = ((g >>> 0) / (j >>> 0)) >>> 0
        return (u(n | 0), o) | 0
      } else {
        if (!m) {
          n = 0
          o = 0
          return (u(n | 0), o) | 0
        }
        c[f >> 2] = a | 0
        c[(f + 4) >> 2] = b & 0
        n = 0
        o = 0
        return (u(n | 0), o) | 0
      }
    }
    m = (l | 0) == 0
    do
      if (j) {
        if (!m) {
          p = ((s(l | 0) | 0) - (s(i | 0) | 0)) | 0
          if (p >>> 0 <= 31) {
            q = (p + 1) | 0
            r = (31 - p) | 0
            t = (p - 31) >> 31
            w = q
            x = ((g >>> (q >>> 0)) & t) | (i << r)
            y = (i >>> (q >>> 0)) & t
            z = 0
            A = g << r
            break
          }
          if (!f) {
            n = 0
            o = 0
            return (u(n | 0), o) | 0
          }
          c[f >> 2] = a | 0
          c[(f + 4) >> 2] = h | (b & 0)
          n = 0
          o = 0
          return (u(n | 0), o) | 0
        }
        r = (j - 1) | 0
        if ((r & j) | 0) {
          t = ((s(j | 0) | 0) + 33 - (s(i | 0) | 0)) | 0
          q = (64 - t) | 0
          p = (32 - t) | 0
          B = p >> 31
          C = (t - 32) | 0
          D = C >> 31
          w = t
          x =
            (((p - 1) >> 31) & (i >>> (C >>> 0))) |
            (((i << p) | (g >>> (t >>> 0))) & D)
          y = D & (i >>> (t >>> 0))
          z = (g << q) & B
          A =
            (((i << q) | (g >>> (C >>> 0))) & B) | ((g << p) & ((t - 33) >> 31))
          break
        }
        if (f | 0) {
          c[f >> 2] = r & g
          c[(f + 4) >> 2] = 0
        }
        if ((j | 0) == 1) {
          n = h | (b & 0)
          o = a | 0 | 0
          return (u(n | 0), o) | 0
        } else {
          r = Oi(j | 0) | 0
          n = (i >>> (r >>> 0)) | 0
          o = (i << (32 - r)) | (g >>> (r >>> 0)) | 0
          return (u(n | 0), o) | 0
        }
      } else {
        if (m) {
          if (f | 0) {
            c[f >> 2] = (i >>> 0) % (j >>> 0)
            c[(f + 4) >> 2] = 0
          }
          n = 0
          o = ((i >>> 0) / (j >>> 0)) >>> 0
          return (u(n | 0), o) | 0
        }
        if (!g) {
          if (f | 0) {
            c[f >> 2] = 0
            c[(f + 4) >> 2] = (i >>> 0) % (l >>> 0)
          }
          n = 0
          o = ((i >>> 0) / (l >>> 0)) >>> 0
          return (u(n | 0), o) | 0
        }
        r = (l - 1) | 0
        if (!(r & l)) {
          if (f | 0) {
            c[f >> 2] = a | 0
            c[(f + 4) >> 2] = (r & i) | (b & 0)
          }
          n = 0
          o = i >>> ((Oi(l | 0) | 0) >>> 0)
          return (u(n | 0), o) | 0
        }
        r = ((s(l | 0) | 0) - (s(i | 0) | 0)) | 0
        if (r >>> 0 <= 30) {
          t = (r + 1) | 0
          p = (31 - r) | 0
          w = t
          x = (i << p) | (g >>> (t >>> 0))
          y = i >>> (t >>> 0)
          z = 0
          A = g << p
          break
        }
        if (!f) {
          n = 0
          o = 0
          return (u(n | 0), o) | 0
        }
        c[f >> 2] = a | 0
        c[(f + 4) >> 2] = h | (b & 0)
        n = 0
        o = 0
        return (u(n | 0), o) | 0
      }
    while (0)
    if (!w) {
      E = A
      F = z
      G = y
      H = x
      I = 0
      J = 0
    } else {
      b = d | 0 | 0
      d = k | (e & 0)
      e = Mi(b | 0, d | 0, -1, -1) | 0
      k = v() | 0
      h = A
      A = z
      z = y
      y = x
      x = w
      w = 0
      do {
        a = h
        h = (A >>> 31) | (h << 1)
        A = w | (A << 1)
        g = (y << 1) | (a >>> 31) | 0
        a = (y >>> 31) | (z << 1) | 0
        Ni(e | 0, k | 0, g | 0, a | 0) | 0
        i = v() | 0
        l = (i >> 31) | (((i | 0) < 0 ? -1 : 0) << 1)
        w = l & 1
        y =
          Ni(
            g | 0,
            a | 0,
            (l & b) | 0,
            (((((i | 0) < 0 ? -1 : 0) >> 31) | (((i | 0) < 0 ? -1 : 0) << 1)) &
              d) |
              0
          ) | 0
        z = v() | 0
        x = (x - 1) | 0
      } while ((x | 0) != 0)
      E = h
      F = A
      G = z
      H = y
      I = 0
      J = w
    }
    w = F
    F = 0
    if (f | 0) {
      c[f >> 2] = H
      c[(f + 4) >> 2] = G
    }
    n = ((w | 0) >>> 31) | ((E | F) << 1) | (((F << 1) | (w >>> 31)) & 0) | I
    o = (((w << 1) | (0 >>> 31)) & -2) | J
    return (u(n | 0), o) | 0
  }
  function Qi(a, b, c, d) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    return Pi(a, b, c, d, 0) | 0
  }
  function Ri(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    if ((c | 0) < 32) {
      u((b >>> c) | 0)
      return (a >>> c) | ((b & ((1 << c) - 1)) << (32 - c))
    }
    u(0)
    return (b >>> (c - 32)) | 0
  }
  function Si(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    if ((c | 0) < 32) {
      u((b << c) | ((a & (((1 << c) - 1) << (32 - c))) >>> (32 - c)) | 0)
      return a << c
    }
    u((a << (c - 32)) | 0)
    return 0
  }
  function Ti(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0
    if ((e | 0) >= 8192) {
      ha(b | 0, d | 0, e | 0) | 0
      return b | 0
    }
    f = b | 0
    g = (b + e) | 0
    if ((b & 3) == (d & 3)) {
      while (b & 3) {
        if (!e) return f | 0
        a[b >> 0] = a[d >> 0] | 0
        b = (b + 1) | 0
        d = (d + 1) | 0
        e = (e - 1) | 0
      }
      h = (g & -4) | 0
      e = (h - 64) | 0
      while ((b | 0) <= (e | 0)) {
        c[b >> 2] = c[d >> 2]
        c[(b + 4) >> 2] = c[(d + 4) >> 2]
        c[(b + 8) >> 2] = c[(d + 8) >> 2]
        c[(b + 12) >> 2] = c[(d + 12) >> 2]
        c[(b + 16) >> 2] = c[(d + 16) >> 2]
        c[(b + 20) >> 2] = c[(d + 20) >> 2]
        c[(b + 24) >> 2] = c[(d + 24) >> 2]
        c[(b + 28) >> 2] = c[(d + 28) >> 2]
        c[(b + 32) >> 2] = c[(d + 32) >> 2]
        c[(b + 36) >> 2] = c[(d + 36) >> 2]
        c[(b + 40) >> 2] = c[(d + 40) >> 2]
        c[(b + 44) >> 2] = c[(d + 44) >> 2]
        c[(b + 48) >> 2] = c[(d + 48) >> 2]
        c[(b + 52) >> 2] = c[(d + 52) >> 2]
        c[(b + 56) >> 2] = c[(d + 56) >> 2]
        c[(b + 60) >> 2] = c[(d + 60) >> 2]
        b = (b + 64) | 0
        d = (d + 64) | 0
      }
      while ((b | 0) < (h | 0)) {
        c[b >> 2] = c[d >> 2]
        b = (b + 4) | 0
        d = (d + 4) | 0
      }
    } else {
      h = (g - 4) | 0
      while ((b | 0) < (h | 0)) {
        a[b >> 0] = a[d >> 0] | 0
        a[(b + 1) >> 0] = a[(d + 1) >> 0] | 0
        a[(b + 2) >> 0] = a[(d + 2) >> 0] | 0
        a[(b + 3) >> 0] = a[(d + 3) >> 0] | 0
        b = (b + 4) | 0
        d = (d + 4) | 0
      }
    }
    while ((b | 0) < (g | 0)) {
      a[b >> 0] = a[d >> 0] | 0
      b = (b + 1) | 0
      d = (d + 1) | 0
    }
    return f | 0
  }
  function Ui(b, c, d) {
    b = b | 0
    c = c | 0
    d = d | 0
    var e = 0
    if (((c | 0) < (b | 0)) & ((b | 0) < ((c + d) | 0))) {
      e = b
      c = (c + d) | 0
      b = (b + d) | 0
      while ((d | 0) > 0) {
        b = (b - 1) | 0
        c = (c - 1) | 0
        d = (d - 1) | 0
        a[b >> 0] = a[c >> 0] | 0
      }
      b = e
    } else Ti(b, c, d) | 0
    return b | 0
  }
  function Vi(b, d, e) {
    b = b | 0
    d = d | 0
    e = e | 0
    var f = 0,
      g = 0,
      h = 0,
      i = 0
    f = (b + e) | 0
    d = d & 255
    if ((e | 0) >= 67) {
      while (b & 3) {
        a[b >> 0] = d
        b = (b + 1) | 0
      }
      g = (f & -4) | 0
      h = d | (d << 8) | (d << 16) | (d << 24)
      i = (g - 64) | 0
      while ((b | 0) <= (i | 0)) {
        c[b >> 2] = h
        c[(b + 4) >> 2] = h
        c[(b + 8) >> 2] = h
        c[(b + 12) >> 2] = h
        c[(b + 16) >> 2] = h
        c[(b + 20) >> 2] = h
        c[(b + 24) >> 2] = h
        c[(b + 28) >> 2] = h
        c[(b + 32) >> 2] = h
        c[(b + 36) >> 2] = h
        c[(b + 40) >> 2] = h
        c[(b + 44) >> 2] = h
        c[(b + 48) >> 2] = h
        c[(b + 52) >> 2] = h
        c[(b + 56) >> 2] = h
        c[(b + 60) >> 2] = h
        b = (b + 64) | 0
      }
      while ((b | 0) < (g | 0)) {
        c[b >> 2] = h
        b = (b + 4) | 0
      }
    }
    while ((b | 0) < (f | 0)) {
      a[b >> 0] = d
      b = (b + 1) | 0
    }
    return (f - e) | 0
  }
  function Wi(a) {
    a = a | 0
    var b = 0,
      d = 0,
      e = 0
    b = ga() | 0
    d = c[i >> 2] | 0
    e = (d + a) | 0
    if ((((a | 0) > 0) & ((e | 0) < (d | 0))) | ((e | 0) < 0)) {
      ja(e | 0) | 0
      P(12)
      return -1
    }
    if ((e | 0) > (b | 0))
      if (!(ia(e | 0) | 0)) {
        P(12)
        return -1
      }
    c[i >> 2] = e
    return d | 0
  }
  function Xi(a) {
    a = a | 0
    return hb[a & 3]() | 0
  }
  function Yi(a, b) {
    a = a | 0
    b = b | 0
    return ib[a & 15](b | 0) | 0
  }
  function Zi(a, b, c, d, e, f, g) {
    a = a | 0
    b = b | 0
    c = +c
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    return jb[a & 1](b | 0, +c, d | 0, e | 0, f | 0, g | 0) | 0
  }
  function _i(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    return kb[a & 63](b | 0, c | 0) | 0
  }
  function $i(a, b, c, d) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    return lb[a & 7](b | 0, c | 0, d | 0) | 0
  }
  function aj(a, b, c, d, e) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    e = e | 0
    return mb[a & 1](b | 0, c | 0, d | 0, e | 0) | 0
  }
  function bj(a) {
    a = a | 0
    nb[a & 3]()
  }
  function cj(a, b) {
    a = a | 0
    b = b | 0
    ob[a & 255](b | 0)
  }
  function dj(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    pb[a & 15](b | 0, c | 0)
  }
  function ej(a, b, c, d) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    qb[a & 7](b | 0, c | 0, d | 0)
  }
  function fj(a, b, c, d, e) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    e = e | 0
    rb[a & 7](b | 0, c | 0, d | 0, e | 0)
  }
  function gj(a, b, c, d, e, f) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    e = e | 0
    f = f | 0
    sb[a & 3](b | 0, c | 0, d | 0, e | 0, f | 0)
  }
  function hj(a, b, c, d, e, f, g) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    e = e | 0
    f = f | 0
    g = g | 0
    tb[a & 3](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0)
  }
  function ij() {
    t(0)
    return 0
  }
  function jj(a) {
    a = a | 0
    t(1)
    return 0
  }
  function kj(a, b, c, d, e, f) {
    a = a | 0
    b = +b
    c = c | 0
    d = d | 0
    e = e | 0
    f = f | 0
    t(2)
    return 0
  }
  function lj(a, b) {
    a = a | 0
    b = b | 0
    t(3)
    return 0
  }
  function mj(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    t(4)
    return 0
  }
  function nj(a, b, c, d) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    t(5)
    return 0
  }
  function oj() {
    t(6)
  }
  function pj(a) {
    a = a | 0
    t(7)
  }
  function qj(a, b) {
    a = a | 0
    b = b | 0
    t(8)
  }
  function rj(a, b, c) {
    a = a | 0
    b = b | 0
    c = c | 0
    t(9)
  }
  function sj(a, b, c, d) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    t(10)
  }
  function tj(a, b, c, d, e) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    e = e | 0
    t(11)
  }
  function uj(a, b, c, d, e, f) {
    a = a | 0
    b = b | 0
    c = c | 0
    d = d | 0
    e = e | 0
    f = f | 0
    t(12)
  }

  // EMSCRIPTEN_END_FUNCS
  var hb = [ij, hg, pg, ij]
  var ib = [jj, ri, bc, hc, yg, rh, li, eg, ig, Cb, mg, qg, jj, jj, jj, jj]
  var jb = [kj, Hg]
  var kb = [
    lj,
    Nb,
    Sb,
    gc,
    Tc,
    cd,
    id,
    od,
    pd,
    Ad,
    Ed,
    Kd,
    Pd,
    Ud,
    Zd,
    ie,
    ke,
    qe,
    se,
    xe,
    ze,
    Ee,
    Ge,
    Le,
    Qe,
    Ve,
    Xe,
    bf,
    hf,
    qf,
    uf,
    yf,
    Ef,
    Hf,
    Lf,
    Of,
    Uf,
    Xf,
    $f,
    cg,
    lg,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
    lj,
  ]
  var lb = [mj, zg, Rh, ui, wi, mj, mj, mj]
  var mb = [nj, Ag]
  var nb = [oj, Kh, di, oj]
  var ob = [
    pj,
    sh,
    Lb,
    Mb,
    Ob,
    Qb,
    Rb,
    Tb,
    pi,
    _b,
    ic,
    ac,
    dc,
    ec,
    mc,
    nc,
    qc,
    rc,
    zc,
    Ac,
    Bc,
    Ec,
    Rc,
    Sc,
    Uc,
    bd,
    dd,
    ed,
    gd,
    hd,
    jd,
    md,
    nd,
    yd,
    zd,
    Bd,
    Cd,
    Dd,
    Id,
    Jd,
    Ld,
    Nd,
    Od,
    Sd,
    Td,
    Vd,
    Xd,
    Yd,
    ge,
    he,
    je,
    le,
    me,
    oe,
    pe,
    re,
    te,
    ue,
    ve,
    we,
    ye,
    Ae,
    Be,
    Ce,
    De,
    Fe,
    He,
    Ie,
    Je,
    Ke,
    Me,
    Oe,
    Pe,
    Re,
    Te,
    Ue,
    We,
    Ye,
    Ze,
    $e,
    af,
    cf,
    ff,
    gf,
    of,
    pf,
    rf,
    sf,
    tf,
    wf,
    xf,
    zf,
    Cf,
    Df,
    Ff,
    Gf,
    If,
    Jf,
    Kf,
    Mf,
    Nf,
    Pf,
    Sf,
    Tf,
    Vf,
    Wf,
    Yf,
    Zf,
    _f,
    ag,
    bg,
    dg,
    ph,
    qh,
    Nh,
    Oh,
    Ph,
    Qh,
    _h,
    ji,
    ki,
    qi,
    si,
    ti,
    vi,
    yi,
    fg,
    ng,
    ei,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
    pj,
  ]
  var pb = [qj, cc, fc, Bb, Eb, Fb, Gb, Hb, Ig, qj, qj, qj, qj, qj, qj, qj]
  var qb = [rj, Ab, kg, Db, sg, tg, rj, rj]
  var rb = [sj, Uh, bi, Bi, jg, rg, sj, sj]
  var sb = [tj, Th, ai, Ai]
  var tb = [uj, Sh, $h, zi]
  return {
    __ZSt18uncaught_exceptionv: nh,
    ___cxa_can_catch: Ii,
    ___cxa_is_pointer_type: Ji,
    ___embind_register_native_and_builtin_types: wg,
    ___errno_location: Cg,
    ___getTypeName: xg,
    ___muldi3: Li,
    ___udivdi3: Qi,
    _bitshift64Lshr: Ri,
    _bitshift64Shl: Si,
    _free: gh,
    _i64Add: Mi,
    _i64Subtract: Ni,
    _malloc: fh,
    _memcpy: Ti,
    _memmove: Ui,
    _memset: Vi,
    _sbrk: Wi,
    dynCall_i: Xi,
    dynCall_ii: Yi,
    dynCall_iidiiii: Zi,
    dynCall_iii: _i,
    dynCall_iiii: $i,
    dynCall_iiiii: aj,
    dynCall_v: bj,
    dynCall_vi: cj,
    dynCall_vii: dj,
    dynCall_viii: ej,
    dynCall_viiii: fj,
    dynCall_viiiii: gj,
    dynCall_viiiiii: hj,
    establishStackSpace: yb,
    globalCtors: ub,
    stackAlloc: vb,
    stackRestore: xb,
    stackSave: wb,
  }
})(
  // EMSCRIPTEN_END_ASM
  asmGlobalArg,
  asmLibraryArg,
  buffer
)
var __ZSt18uncaught_exceptionv = (Module['__ZSt18uncaught_exceptionv'] =
  asm['__ZSt18uncaught_exceptionv'])
var ___cxa_can_catch = (Module['___cxa_can_catch'] = asm['___cxa_can_catch'])
var ___cxa_is_pointer_type = (Module['___cxa_is_pointer_type'] =
  asm['___cxa_is_pointer_type'])
var ___embind_register_native_and_builtin_types = (Module[
  '___embind_register_native_and_builtin_types'
] = asm['___embind_register_native_and_builtin_types'])
var ___errno_location = (Module['___errno_location'] = asm['___errno_location'])
var ___getTypeName = (Module['___getTypeName'] = asm['___getTypeName'])
var ___muldi3 = (Module['___muldi3'] = asm['___muldi3'])
var ___udivdi3 = (Module['___udivdi3'] = asm['___udivdi3'])
var _bitshift64Lshr = (Module['_bitshift64Lshr'] = asm['_bitshift64Lshr'])
var _bitshift64Shl = (Module['_bitshift64Shl'] = asm['_bitshift64Shl'])
var _free = (Module['_free'] = asm['_free'])
var _i64Add = (Module['_i64Add'] = asm['_i64Add'])
var _i64Subtract = (Module['_i64Subtract'] = asm['_i64Subtract'])
var _malloc = (Module['_malloc'] = asm['_malloc'])
var _memcpy = (Module['_memcpy'] = asm['_memcpy'])
var _memmove = (Module['_memmove'] = asm['_memmove'])
var _memset = (Module['_memset'] = asm['_memset'])
var _sbrk = (Module['_sbrk'] = asm['_sbrk'])
var establishStackSpace = (Module['establishStackSpace'] =
  asm['establishStackSpace'])
var globalCtors = (Module['globalCtors'] = asm['globalCtors'])
var stackAlloc = (Module['stackAlloc'] = asm['stackAlloc'])
var stackRestore = (Module['stackRestore'] = asm['stackRestore'])
var stackSave = (Module['stackSave'] = asm['stackSave'])
var dynCall_i = (Module['dynCall_i'] = asm['dynCall_i'])
var dynCall_ii = (Module['dynCall_ii'] = asm['dynCall_ii'])
var dynCall_iidiiii = (Module['dynCall_iidiiii'] = asm['dynCall_iidiiii'])
var dynCall_iii = (Module['dynCall_iii'] = asm['dynCall_iii'])
var dynCall_iiii = (Module['dynCall_iiii'] = asm['dynCall_iiii'])
var dynCall_iiiii = (Module['dynCall_iiiii'] = asm['dynCall_iiiii'])
var dynCall_v = (Module['dynCall_v'] = asm['dynCall_v'])
var dynCall_vi = (Module['dynCall_vi'] = asm['dynCall_vi'])
var dynCall_vii = (Module['dynCall_vii'] = asm['dynCall_vii'])
var dynCall_viii = (Module['dynCall_viii'] = asm['dynCall_viii'])
var dynCall_viiii = (Module['dynCall_viiii'] = asm['dynCall_viiii'])
var dynCall_viiiii = (Module['dynCall_viiiii'] = asm['dynCall_viiiii'])
var dynCall_viiiiii = (Module['dynCall_viiiiii'] = asm['dynCall_viiiiii'])
Module['asm'] = asm
if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    memoryInitializer = locateFile(memoryInitializer)
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer)
    HEAPU8.set(data, GLOBAL_BASE)
  } else {
    addRunDependency('memory initializer')
    var applyMemoryInitializer = function (data) {
      if (data.byteLength) data = new Uint8Array(data)
      HEAPU8.set(data, GLOBAL_BASE)
      if (Module['memoryInitializerRequest'])
        delete Module['memoryInitializerRequest'].response
      removeRunDependency('memory initializer')
    }
    var doBrowserLoad = function () {
      Module['readAsync'](
        memoryInitializer,
        applyMemoryInitializer,
        function () {
          throw 'could not load memory initializer ' + memoryInitializer
        }
      )
    }
    if (Module['memoryInitializerRequest']) {
      var useRequest = function () {
        var request = Module['memoryInitializerRequest']
        var response = request.response
        if (request.status !== 200 && request.status !== 0) {
          console.warn(
            'a problem seems to have happened with Module.memoryInitializerRequest, status: ' +
              request.status +
              ', retrying ' +
              memoryInitializer
          )
          doBrowserLoad()
          return
        }
        applyMemoryInitializer(response)
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0)
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest)
      }
    } else {
      doBrowserLoad()
    }
  }
}
function ExitStatus(status) {
  this.name = 'ExitStatus'
  this.message = 'Program terminated with exit(' + status + ')'
  this.status = status
}
ExitStatus.prototype = new Error()
ExitStatus.prototype.constructor = ExitStatus
dependenciesFulfilled = function runCaller() {
  if (!Module['calledRun']) run()
  if (!Module['calledRun']) dependenciesFulfilled = runCaller
}
function run(args) {
  args = args || Module['arguments']
  if (runDependencies > 0) {
    return
  }
  preRun()
  if (runDependencies > 0) return
  if (Module['calledRun']) return
  function doRun() {
    if (Module['calledRun']) return
    Module['calledRun'] = true
    if (ABORT) return
    initRuntime()
    preMain()
    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']()
    postRun()
  }
  if (Module['setStatus']) {
    Module['setStatus']('Running...')
    setTimeout(function () {
      setTimeout(function () {
        Module['setStatus']('')
      }, 1)
      doRun()
    }, 1)
  } else {
    doRun()
  }
}
Module['run'] = run
function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what)
  }
  if (what !== undefined) {
    out(what)
    err(what)
    what = '"' + what + '"'
  } else {
    what = ''
  }
  ABORT = true
  EXITSTATUS = 1
  throw 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.'
}
Module['abort'] = abort
if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function')
    Module['preInit'] = [Module['preInit']]
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()()
  }
}
Module['noExitRuntime'] = true
run()
