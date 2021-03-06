/**
 * @module bindings/textarea
 */
import { createMutex } from 'lib0/mutex.js'
import * as math from 'lib0/math.js'
import * as Y from 'yjs'
import * as Ys from './RelativePosition.js'
//import { CoCreateYSocket } from '../../y-client/src/CoCreate-y'

const debug = false;



const typeObserver = (binding, event) => {
  binding._mux(() => {
        if(debug)
          console.log(" Listener typeObserver Codemirror ")
        const cm = binding.target
        const element = binding.target.getOption('element');
        const readValue = element.getAttribute('data-read_value') != 'false';
        if (!readValue) {
          return;
        }
        element.crudSetted = true;
        cm.operation(() => {
          const delta = event.delta
          let index = 0
          for (let i = 0; i < event.delta.length; i++) {
            const d = delta[i]
            if (d.retain) {
              index += d.retain
            } else if (d.insert) {
              const pos = cm.posFromIndex(index)
              cm.replaceRange(d.insert, pos, pos, 'prosemirror-binding')
              if(debug)
                console.log("Insert -> ",pos)
              index += d.insert.length
            } else if (d.delete) {
              const start = cm.posFromIndex(index)
              const end = cm.posFromIndex(index + d.delete)
              if(debug)
                console.log("delete  -> ",start," end",end)
              cm.replaceRange('', start, end, 'prosemirror-binding')
            }
          }
        })
  })
}

const targetObserver = (binding, change) => {
  binding._mux(() => {
    if(debug)
      console.log("SEND targetObserver change Shredtype cd")
    var element = binding.target.getOption('element');
    var realtime = element.getAttribute('data-realtime') != 'false';
    var saveValue = element.getAttribute('data-save_value') != 'false';
    var readValue = element.getAttribute('data-read_value') != 'false';
    
    if(!realtime || !saveValue)
      return;
    if (!readValue) {
      binding.type.delete(0, binding.type.toString().length)
      binding.type.insert(0, binding.target.getValue())
    }
    const start = binding.target.indexFromPos(change.from)
    const delLen = change.removed.map(s => s.length).reduce(math.add) + change.removed.length - 1
    if (delLen > 0) {
      binding.type.delete(start, delLen)
      if(debug)
        console.log("start ",start,'delLen ',delLen)
    }
    if (change.text.length > 0) {
      binding.type.insert(start, change.text.join('\n'))
     
     //CodeJEAN
      let end = 0;
      change.text.forEach(function(ele,i){
        end += ele.length;
      });
      if(debug)
        console.log("targetObserver start",start,'end',end);
      
    //ENDCodeJEAN/
    }
  })
}

/** comment by jin (2020-08-11) **/
// const createRemoteCaret = (username, color) => {
//   if(debug)
//     console.log(" Create caret")
//   const caret = document.createElement('span')
//   caret.classList.add('remote-caret')
//   caret.setAttribute('style', `border-color: ${color}`)
//   const userDiv = document.createElement('div')
//   userDiv.setAttribute('style', `background-color: ${color}`)
//   userDiv.insertBefore(document.createTextNode(username), null)
//   caret.insertBefore(userDiv, null)
//   return caret
// }

const updateRemoteSelection = (y, cm, type, cursors, clientId, awareness) => {
  // destroy current text mark
  const m = cursors.get(clientId)
  if (m !== undefined) {
    m.caret.clear()
    if (m.sel !== null) {
      m.sel.clear()
    }
    cursors.delete(clientId)
  }
  // redraw caret and selection for clientId
  const aw = awareness.getStates().get(clientId);
  if (aw === undefined) {
    return
  }
  const user = aw.user || {}
  if (user.color == null) {
    user.color = '#ffa500'
  }
  if (user.name == null) {
    user.name = `User: ${clientId}`
  }
  const cursor = aw.cursor
  if (cursor == null || cursor.anchor == null || cursor.head == null) {
    return
  }
  //const anchor = Y.createAbsolutePositionFromRelativePosition(JSON.parse(cursor.anchor), y)

  const anchor = Ys.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(cursor.anchor), y)
  //const head = Y.createAbsolutePositionFromRelativePosition(JSON.parse(cursor.head), y)
  const head = Ys.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(cursor.head), y)

  /*console.log("TYPE comparation ",anchor.type == type)
  console.log("TYPE  ",type)
  console.log("TYPE  anchor ",anchor.type)*/
  if (anchor !== null && head !== null && anchor.type === type && head.type === type) {
    const headpos = cm.posFromIndex(head.index)
    const anchorpos = cm.posFromIndex(anchor.index)
    let from, to
    if (head.index < anchor.index) {
      from = headpos
      to = anchorpos
    } else {
      from = anchorpos
      to = headpos
    }
    
    const caretEl = createRemoteCaret(user.name, user.color)
    const caret = cm.setBookmark(headpos, { widget: caretEl, insertLeft: true })
    let sel = null
    if (head.index !== anchor.index) {
      sel = cm.markText(from, to, { css: `background-color: ${user.color}70`, inclusiveRight: true, inclusiveLeft: false })
    }
    cursors.set(clientId, { caret, sel })
    if(debug)
      console.log("updateRemoteSelection from codemirror ")
    
  }
}

/** comment by jin (2020-08-11) **/
// const codemirrorCursorActivity = (y, cm, type, awareness) => {
//   if (!cm.hasFocus()) {
//     return
//   }
//   if(debug)
//     console.log("codemirrorCursorActivity start ",cm.indexFromPos(cm.getCursor('anchor'))," end ",cm.indexFromPos(cm.getCursor('head')))
//   const newAnchor = Y.createRelativePositionFromTypeIndex(type, cm.indexFromPos(cm.getCursor('anchor')))
//   const newHead = Y.createRelativePositionFromTypeIndex(type, cm.indexFromPos(cm.getCursor('head')))
//   const aw = awareness.getLocalState()
//   let currentAnchor = null
//   let currentHead = null
//   if (aw.cursor != null) {
//     currentAnchor = aw.cursor.anchor;// Y.createAbsolutePositionFromRelativePosition(JSON.parse(aw.cursor.anchor), y)
//     currentHead = aw.cursor.head; // Y.createAbsolutePositionFromRelativePosition(JSON.parse(aw.cursor.head), y)
//   }
//   if (aw.cursor == null || !Y.compareRelativePositions(currentAnchor, newAnchor) || !Y.compareRelativePositions(currentHead, newHead)) {
//     awareness.setLocalStateField('cursor', {
//       anchor: newAnchor,
//       head: newHead
//     })
//     if(debug)
//       console.log("Send cursor  from codemirrorCursorActivity  ",{
//           anchor: newAnchor,
//           head: newHead
//         })  
//   }else {
//     let start = cm.indexFromPos(cm.getCursor('anchor'));
//     let end = cm.indexFromPos(cm.getCursor('head'));
//     console.log("Else codemirrorCursorActivity",start,end)  
    
//     if(start == end){
//         const newAnchor = Y.createRelativePositionFromTypeIndex(type, start);
//         const newHead = Y.createRelativePositionFromTypeIndex(type, end);
//         awareness.setLocalStateField('cursor', {
//           anchor: newAnchor,
//           head: newHead
//         });
//         if(debug)
//           console.log("SEND Postion targetObserver  ",(start+end)) 
//       }
      
//   }
  
//   //console.log('---------------------cm----------------------')
//   //console.log(currentAnchor, currentHead, newAnchor, newHead);
// }


const codemirrorCursorActivity = (y, cm, type, awareness) => {
  const aw = awareness.getLocalState()
  if (!cm.hasFocus() || aw == null || !cm.display.wrapper.ownerDocument.hasFocus()) {
    return
  }
  const newAnchor = Y.createRelativePositionFromTypeIndex(type, cm.indexFromPos(cm.getCursor('anchor')))
  const newHead = Y.createRelativePositionFromTypeIndex(type, cm.indexFromPos(cm.getCursor('head')))
  let currentAnchor = null
  let currentHead = null
  if (aw.cursor != null) {
    currentAnchor = Y.createRelativePositionFromJSON(JSON.parse(aw.cursor.anchor))
    currentHead = Y.createRelativePositionFromJSON(JSON.parse(aw.cursor.head))
  }
  if (aw.cursor == null || !Y.compareRelativePositions(currentAnchor, newAnchor) || !Y.compareRelativePositions(currentHead, newHead)) {
    awareness.setLocalStateField('cursor', {
      anchor: JSON.stringify(newAnchor),
      head: JSON.stringify(newHead)
    })
  }
}

const createRemoteCaret = (username, color) => {
  const caret = document.createElement('span')
  caret.classList.add('remote-caret')
  caret.setAttribute('style', `border-color: ${color}`)
  const userDiv = document.createElement('div')
  userDiv.setAttribute('style', `background-color: ${color}`)
  userDiv.insertBefore(document.createTextNode(username), null)
  caret.insertBefore(userDiv, null)
  setTimeout(() => {
    caret.classList.add('hide-name')
  }, 2000)
  return caret
}

/**
 * @typedef {any} CodeMirror A codemirror instance
 */

/**
 * A binding that binds a YText to a CodeMirror editor.
 *
 * @example
 *   const ytext = ydocument.define('codemirror', Y.Text)
 *   const editor = new CodeMirror(document.querySelector('#container'), {
 *     mode: 'javascript',
 *     lineNumbers: true
 *   })
 *   const binding = new CodeMirrorBinding(ytext, editor)
 *
 */
export class CodeMirrorBinding {
  /**
   * @param {Y.Text} textType
   * @param {CodeMirror} codeMirror
   * @param {any} [awareness]
   */
  constructor (textType, codeMirror, awareness) {
    const doc = textType.doc
    this.type = textType
    this.target = codeMirror
    this.awareness = awareness

    /**
     * @private
     */
    this._mux = createMutex()
    // set initial value
    codeMirror.setValue(textType.toString())
    // observe type and target
    this._typeObserver = event => typeObserver(this, event)
    this._targetObserver = (_, change) => targetObserver(this, change)
    this._cursors = new Map()
    this._awarenessListener = event => {
      const f = clientId => {
        if (clientId !== doc.clientID) {
          updateRemoteSelection(doc, codeMirror, textType, this._cursors, clientId, awareness)
        }
      }

      event.added.forEach(f)
      event.removed.forEach(f)
      event.updated.forEach(f)
    }
    this._cursorListener = () => codemirrorCursorActivity(doc, codeMirror, textType, awareness)
    this._blurListeer = () => awareness.setLocalStateField('cursor', null)

    textType.observe(this._typeObserver)
    codeMirror.on('change', this._targetObserver)
    if (awareness) {
      awareness.on('change', this._awarenessListener)
      codeMirror.on('cursorActivity', this._cursorListener)
      codeMirror.on('blur', this._blurListeer)
      codeMirror.on('focus', this._cursorListener)
    }
  }
  destroy () {
    this.type.unobserve(this._typeObserver)
    this.target.off('change', this._targetObserver)
    this.target.off('cursorActivity', this._cursorListener)
    this.target.off('focus', this._cursorListener)
    this.target.off('blur', this._blurListeer)
    this.awareness.off('change', this._awarenessListener)
    this.type = null
    this.target = null
  }
}
