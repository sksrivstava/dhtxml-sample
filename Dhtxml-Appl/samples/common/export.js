(function () {
  'use strict';

  /*
   * Copyright 2017 Sam Thorogood. All rights reserved.
   *
   * Licensed under the Apache License, Version 2.0 (the "License"); you may not
   * use this file except in compliance with the License. You may obtain a copy of
   * the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  /**
   * @fileoverview Polyfill for TextEncoder and TextDecoder.
   *
   * You probably want `text.min.js`, and not this file directly.
   */

  (function(scope) {

  // fail early
  if (scope['TextEncoder'] && scope['TextDecoder']) {
    return false;
  }

  /**
   * @constructor
   * @param {string=} utfLabel
   */
  function FastTextEncoder(utfLabel='utf-8') {
    if (utfLabel !== 'utf-8') {
      throw new RangeError(
        `Failed to construct 'TextEncoder': The encoding label provided ('${utfLabel}') is invalid.`);
    }
  }

  Object.defineProperty(FastTextEncoder.prototype, 'encoding', {value: 'utf-8'});

  /**
   * @param {string} string
   * @param {{stream: boolean}=} options
   * @return {!Uint8Array}
   */
  FastTextEncoder.prototype.encode = function(string, options={stream: false}) {
    if (options.stream) {
      throw new Error(`Failed to encode: the 'stream' option is unsupported.`);
    }

    let pos = 0;
    const len = string.length;

    let at = 0;  // output position
    let tlen = Math.max(32, len + (len >> 1) + 7);  // 1.5x size
    let target = new Uint8Array((tlen >> 3) << 3);  // ... but at 8 byte offset

    while (pos < len) {
      let value = string.charCodeAt(pos++);
      if (value >= 0xd800 && value <= 0xdbff) {
        // high surrogate
        if (pos < len) {
          const extra = string.charCodeAt(pos);
          if ((extra & 0xfc00) === 0xdc00) {
            ++pos;
            value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
          }
        }
        if (value >= 0xd800 && value <= 0xdbff) {
          continue;  // drop lone surrogate
        }
      }

      // expand the buffer if we couldn't write 4 bytes
      if (at + 4 > target.length) {
        tlen += 8;  // minimum extra
        tlen *= (1.0 + (pos / string.length) * 2);  // take 2x the remaining
        tlen = (tlen >> 3) << 3;  // 8 byte offset

        const update = new Uint8Array(tlen);
        update.set(target);
        target = update;
      }

      if ((value & 0xffffff80) === 0) {  // 1-byte
        target[at++] = value;  // ASCII
        continue;
      } else if ((value & 0xfffff800) === 0) {  // 2-byte
        target[at++] = ((value >>  6) & 0x1f) | 0xc0;
      } else if ((value & 0xffff0000) === 0) {  // 3-byte
        target[at++] = ((value >> 12) & 0x0f) | 0xe0;
        target[at++] = ((value >>  6) & 0x3f) | 0x80;
      } else if ((value & 0xffe00000) === 0) {  // 4-byte
        target[at++] = ((value >> 18) & 0x07) | 0xf0;
        target[at++] = ((value >> 12) & 0x3f) | 0x80;
        target[at++] = ((value >>  6) & 0x3f) | 0x80;
      } else {
        // FIXME: do we care
        continue;
      }

      target[at++] = (value & 0x3f) | 0x80;
    }

    return target.slice(0, at);
  };

  /**
   * @constructor
   * @param {string=} utfLabel
   * @param {{fatal: boolean}=} options
   */
  function FastTextDecoder(utfLabel='utf-8', options={fatal: false}) {
    if (utfLabel !== 'utf-8') {
      throw new RangeError(
        `Failed to construct 'TextDecoder': The encoding label provided ('${utfLabel}') is invalid.`);
    }
    if (options.fatal) {
      throw new Error(`Failed to construct 'TextDecoder': the 'fatal' option is unsupported.`);
    }
  }

  Object.defineProperty(FastTextDecoder.prototype, 'encoding', {value: 'utf-8'});

  Object.defineProperty(FastTextDecoder.prototype, 'fatal', {value: false});

  Object.defineProperty(FastTextDecoder.prototype, 'ignoreBOM', {value: false});

  /**
   * @param {(!ArrayBuffer|!ArrayBufferView)} buffer
   * @param {{stream: boolean}=} options
   */
  FastTextDecoder.prototype.decode = function(buffer, options={stream: false}) {
    if (options['stream']) {
      throw new Error(`Failed to decode: the 'stream' option is unsupported.`);
    }

    const bytes = new Uint8Array(buffer);
    let pos = 0;
    const len = bytes.length;
    const out = [];

    while (pos < len) {
      const byte1 = bytes[pos++];
      if (byte1 === 0) {
        break;  // NULL
      }
    
      if ((byte1 & 0x80) === 0) {  // 1-byte
        out.push(byte1);
      } else if ((byte1 & 0xe0) === 0xc0) {  // 2-byte
        const byte2 = bytes[pos++] & 0x3f;
        out.push(((byte1 & 0x1f) << 6) | byte2);
      } else if ((byte1 & 0xf0) === 0xe0) {
        const byte2 = bytes[pos++] & 0x3f;
        const byte3 = bytes[pos++] & 0x3f;
        out.push(((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3);
      } else if ((byte1 & 0xf8) === 0xf0) {
        const byte2 = bytes[pos++] & 0x3f;
        const byte3 = bytes[pos++] & 0x3f;
        const byte4 = bytes[pos++] & 0x3f;

        // this can be > 0xffff, so possibly generate surrogates
        let codepoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
        if (codepoint > 0xffff) {
          // codepoint &= ~0x10000;
          codepoint -= 0x10000;
          out.push((codepoint >>> 10) & 0x3ff | 0xd800);
          codepoint = 0xdc00 | codepoint & 0x3ff;
        }
        out.push(codepoint);
      }
    }

    return String.fromCharCode.apply(null, out);
  };

  scope['TextEncoder'] = FastTextEncoder;
  scope['TextDecoder'] = FastTextDecoder;

  }(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : self)));

  (function() {
      var wasm;
      const __exports = {};


      const heap = new Array(32);

      heap.fill(undefined);

      heap.push(undefined, null, true, false);

      let stack_pointer = 32;

      function addBorrowedObject(obj) {
          if (stack_pointer == 1) throw new Error('out of js stack');
          heap[--stack_pointer] = obj;
          return stack_pointer;
      }

      let cachegetUint8Memory = null;
      function getUint8Memory() {
          if (cachegetUint8Memory === null || cachegetUint8Memory.buffer !== wasm.memory.buffer) {
              cachegetUint8Memory = new Uint8Array(wasm.memory.buffer);
          }
          return cachegetUint8Memory;
      }

      function getArrayU8FromWasm(ptr, len) {
          return getUint8Memory().subarray(ptr / 1, ptr / 1 + len);
      }

      let cachedGlobalArgumentPtr = null;
      function globalArgumentPtr() {
          if (cachedGlobalArgumentPtr === null) {
              cachedGlobalArgumentPtr = wasm.__wbindgen_global_argument_ptr();
          }
          return cachedGlobalArgumentPtr;
      }

      let cachegetUint32Memory = null;
      function getUint32Memory() {
          if (cachegetUint32Memory === null || cachegetUint32Memory.buffer !== wasm.memory.buffer) {
              cachegetUint32Memory = new Uint32Array(wasm.memory.buffer);
          }
          return cachegetUint32Memory;
      }
      /**
      * @param {any} arg0
      * @returns {Uint8Array}
      */
      __exports.import_to_xlsx = function(arg0) {
          const retptr = globalArgumentPtr();
          try {
              wasm.import_to_xlsx(retptr, addBorrowedObject(arg0));
              const mem = getUint32Memory();
              const rustptr = mem[retptr / 4];
              const rustlen = mem[retptr / 4 + 1];

              const realRet = getArrayU8FromWasm(rustptr, rustlen).slice();
              wasm.__wbindgen_free(rustptr, rustlen * 1);
              return realRet;


          } finally {
              heap[stack_pointer++] = undefined;

          }

      };

  function getObject(idx) { return heap[idx]; }

  let cachedTextEncoder = new TextEncoder('utf-8');

  let WASM_VECTOR_LEN = 0;

  function passStringToWasm(arg) {

      const buf = cachedTextEncoder.encode(arg);
      const ptr = wasm.__wbindgen_malloc(buf.length);
      getUint8Memory().set(buf, ptr);
      WASM_VECTOR_LEN = buf.length;
      return ptr;
  }

  __exports.__wbindgen_json_serialize = function(idx, ptrptr) {
      const ptr = passStringToWasm(JSON.stringify(getObject(idx)));
      getUint32Memory()[ptrptr / 4] = ptr;
      return WASM_VECTOR_LEN;
  };

  function init(path_or_module) {
      let instantiation;
      const imports = { './xlsx_import': __exports };
      if (path_or_module instanceof WebAssembly.Module) {
          instantiation = WebAssembly.instantiate(path_or_module, imports)
          .then(instance => {
          return { instance, module: path_or_module }
      });
  } else {
      const data = fetch(path_or_module);
      if (typeof WebAssembly.instantiateStreaming === 'function') {
          instantiation = WebAssembly.instantiateStreaming(data, imports)
          .catch(e => {
              console.warn("`WebAssembly.instantiateStreaming` failed. Assuming this is because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
              return data
              .then(r => r.arrayBuffer())
              .then(bytes => WebAssembly.instantiate(bytes, imports));
          });
      } else {
          instantiation = data
          .then(response => response.arrayBuffer())
          .then(buffer => WebAssembly.instantiate(buffer, imports));
      }
  }
  return instantiation.then(({instance}) => {
      wasm = init.wasm = instance.exports;

  });
  }self.wasm_bindgen = Object.assign(init, __exports);
  })();

  onmessage = function(e) {
      if (e.data.type === "convert"){
          doConvert(e.data);
      }
  };


  let import_to_xlsx = null;
  function doConvert(config){
      if (import_to_xlsx) {
          const result = import_to_xlsx(config.data);
          const blob = new Blob([result], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,"
          });

          postMessage({
              uid: config.uid || (new Date()).valueOf(),
              type: "ready",
              blob
          });
      } else {
          const path = config.wasmPath || "https://cdn.dhtmlx.com/libs/json2excel/1.0/lib.wasm";

          wasm_bindgen(path).then(() => {
              import_to_xlsx = wasm_bindgen.import_to_xlsx;
              doConvert(config);
          }).catch(e => console.log(e));
      }
  }

}());