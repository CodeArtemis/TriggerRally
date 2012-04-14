/* Conversion functions used in OpenID for node.js
 *
 * http://ox.no/software/node-openid
 * http://github.com/havard/node-openid
 *
 * Copyright (C) 2010 by Håvard Stranden
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  
 * -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- 
 * vim: set sw=2 ts=2 et tw=80 : 
 */

var base64 = require('./base64').base64;

function chars_from_hex(inputstr) {
  var outputstr = '';
  inputstr = inputstr.replace(/[^A-Fa-f0-9]/g, '');
  inputstr = inputstr.split('');
  if(inputstr.length % 2 != 0) {
    inputstr.unshift('0');
  }
  for(var i=0; i<inputstr.length; i+=2) {
    outputstr += String.fromCharCode(parseInt(inputstr[i]+''+inputstr[i+1], 16));
  }
  return outputstr;
}

function hex_from_chars(inputstr) {
  var outputstr = '';
  var hex = "0123456789abcdef";
  hex = hex.split('');
  var i, n;
  var inputarr = inputstr.split('');
  for(var i=0; i<inputarr.length; i++) {
    n = inputstr.charCodeAt(i);
    outputstr += hex[(n >> 4) & 0xf] + hex[n & 0xf];
  }
  return outputstr;
}

function btwoc(i)
{
  if(i.charCodeAt(0) > 127)
  {
    return String.fromCharCode(0) + i;
  }
  return i;
}

function unbtwoc(i)
{
  if(i.charCodeAt(0) == String.fromCharCode(0))
  {
    return i.substr(1);
  }

  return i;
}

exports.chars_from_hex = chars_from_hex;
exports.hex_from_chars = hex_from_chars;
exports.btwoc = btwoc;
exports.unbtwoc = unbtwoc;
exports.base64 = base64;
