/*
 * Copyright (C) 2024 ZoneMinder
 * This file is for managing jquery.panzoom.js
 */

var zmPanZoom = {
  panZoomMaxScale: 10,
  panZoomStep: 0.3,
  panZoom: [],
  shifted: null,
  ctrled: null,
  alted: null,
  panOnlyWhenZoomed: true,
  //canvas: true,
  touchAction: 'manipulation',
  /*
  * param.objString - class or id
  */
  init: function(params={}) {
    if (!panZoomEnabled) return;
    const _this = this;
    const object = (params.objString) ? $j(params.objString) : $j('.zoompan');

    object.each( function() {
      params.obj = this;
      _this.action('enable', params);
    });
  },

  /*
  * params['obj'] : DOM object
  * params['id'] : monitor id
  * params['contain'] : "inside" | "outside", default="outside"
  * params['disablePan'] : true || false
  * & etc
  */
  action: function(action, params) {
    const _this = this;
    const objString = params['objString'];
    const contain = (params['contain']) ? params['contain'] : "outside";
    const minScale = (contain != "outside") ? 0.1 : 1.0;
    if (action == "enable") {
      var id;

      if (typeof eventData != 'undefined') {
        id = eventData.MonitorId; //Event page
      } else {
        const obj = this.getStream(params['obj']);

        if (obj.length > 0) {
          id = stringToNumber(obj[0].id); //Montage & Watch page
        }
      }
      if (!id) {
        console.log("The for panZoom action object was not found.", params);
        return;
      }
      $j('.btn-zoom-in').removeClass('hidden');
      $j('.btn-zoom-out').removeClass('hidden');
      const objPanZoom = (params['additional'] && objString) ? id+objString : id;

      // default value for ZM, if not explicitly specified in the parameters
      if (!('contain' in params)) params.contain = contain;
      if (!('minScale' in params)) params.minScale = minScale;
      if (!('maxScale' in params)) params.maxScale = params['additional'] ? 1 : this.panZoomMaxScale;
      if (!('step' in params)) params.step = this.panZoomStep;
      if (!('cursor' in params)) params.cursor = 'inherit';
      if (!('disablePan' in params)) params.disablePan = false;
      if (!('roundPixels' in params)) params.roundPixels = false;
      if (!('panOnlyWhenZoomed' in params)) params.panOnlyWhenZoomed = this.panOnlyWhenZoomed;
      //if (!('canvas' in params)) params.canvas = this.canvas;
      if (!('touchAction' in params)) params.touchAction = this.touchAction;

      //Direct initialization Panzoom
      this.panZoom[objPanZoom] = Panzoom(params['obj'], params);
      this.panZoom[objPanZoom].target = params['obj'];
      this.panZoom[objPanZoom].additional = params['additional'];
      //panZoom[id].pan(10, 10);
      //panZoom[id].zoom(1, {animate: true});
      // Binds to shift || alt + wheel
      params['obj'].parentElement.addEventListener('wheel', function(event) {
        if (!_this.shifted && !_this.alted) {
          return;
        }

        if (_this.shifted && _this.alted) {
          event.preventDefault(); //Avoid page scrolling
          if (!_this.panZoom[objPanZoom].additional) return;

          const obj = (event.target.closest('#monitor'+id)) ? event.target.closest('#monitor'+id)/*Watch & Montage*/ : event.target.closest('#eventVideo')/*Event*/;
          const objDim = obj.getBoundingClientRect();
          //Get the coordinates (x - the middle of the image, y - the top edge) of the point relative to which we will scale the image
          const x = objDim.x + objDim.width/2;
          const y = objDim.y;
          const scale = (event.deltaY < 0) ? _this.panZoom[objPanZoom].getScale() * Math.exp(_this.panZoomStep)/*scrolling up*/ : _this.panZoom[objPanZoom].getScale() / Math.exp(_this.panZoomStep)/*scrolling down*/;
          _this.panZoom[objPanZoom].zoomToPoint(scale, {clientX: x, clientY: y});
        } else if (_this.shifted && !_this.alted) {
          if (!_this.panZoom[id]) return;
          _this.panZoom[id].zoomWithWheel(event);
        } else {
          return;
        }
        _this.setTriggerChangedMonitors(id);
      });

      $j(document).on('keyup.panzoom keydown.panzoom', function(e) {
        _this.shifted = e.shiftKey ? e.shiftKey : e.shift;
        _this.ctrled = e.ctrlKey;
        _this.alted = e.altKey;
        _this.manageCursor(id);
      });

      params['obj'].addEventListener('mousemove', handlePanZoomEventMousemove);
      params['obj'].addEventListener('panzoomchange', handlePanZoomEventPanzoomchange);
      params['obj'].addEventListener('panzoomzoom', handlePanZoomEventPanzoomzoom);
      params['obj'].addEventListener('panzoomstart', handlePanZoomEventPanzoomstart);
      params['obj'].addEventListener('panzoompan', handlePanzoompan);
      params['obj'].addEventListener('panzoomend', handlePanzoomend);
      params['obj'].addEventListener('panzoomreset', handlePanzoomreset);
    } else if (action == "disable") { //Disable a specific object
      if (!this.panZoom[params['id']]) {
        console.log(`PanZoom for monitor "${params['id']}" was not initialized.`);
        return;
      }
      //Disables for the entire document!//$j(document).off('keyup.panzoom keydown.panzoom');
      const obj = this.panZoom[params['id']].target;
      // #videoFeed - Event page, #monitorX - Montage & Watch page
      const el = document.getElementById('videoFeed');
      const wrapper = el ? el : document.getElementById('monitor'+params['id']);

      $j(wrapper).find('.btn-zoom-in, .btn-zoom-out').addClass('hidden');
      this.panZoom[params['id']].reset();
      this.panZoom[params['id']].resetStyle();
      this.panZoom[params['id']].setOptions({disablePan: true, disableZoom: true});
      this.panZoom[params['id']].destroy();
      obj.removeEventListener('panzoomzoom', handlePanZoomEventPanzoomzoom);
      obj.removeEventListener('mousemove', handlePanZoomEventMousemove);
      obj.removeEventListener('panzoomchange', handlePanZoomEventPanzoomchange);
      obj.removeEventListener('panzoomzoom', handlePanZoomEventPanzoomzoom);
      obj.removeEventListener('panzoomstart', handlePanZoomEventPanzoomstart);
      obj.removeEventListener('panzoompan', handlePanzoompan);
      obj.removeEventListener('panzoomend', handlePanzoomend);
      obj.removeEventListener('panzoomreset', handlePanzoomreset);
    }
  },

  zoomIn: function(clickedElement) {
    if (clickedElement.target.id) {
      var id = stringToNumber(clickedElement.target.id);
    } else { //There may be an element without ID inside the button
      var id = stringToNumber(clickedElement.target.parentElement.id);
    }
    if (clickedElement.ctrlKey) {
      // Double the zoom step.
      this.panZoom[id].zoom(this.panZoom[id].getScale() * Math.exp(this.panZoomStep*2), {animate: true});
    } else {
      this.panZoom[id].zoomIn();
    }
    this.setTriggerChangedMonitors(id);
    this.setTouchAction(this.panZoom[id]);
    this.manageCursor(id);
  },

  zoomOut: function(clickedElement) {
    const id = stringToNumber(clickedElement.target.id ? clickedElement.target.id : clickedElement.target.parentElement.id);
    if (clickedElement.ctrlKey) {
      // Reset zoom
      this.panZoom[id].zoom(1, {animate: true});
    } else {
      this.panZoom[id].zoomOut();
    }
    this.setTriggerChangedMonitors(id);
    this.setTouchAction(this.panZoom[id]);
    this.manageCursor(id);
  },

  setTouchAction: function(el) {
    const currentScale = el.getScale().toFixed(1);
console.log("currentScale_=>", currentScale);
    if (currentScale == 1) {
      el.setOptions({ touchAction: 'manipulation' });
    } else {
      el.setOptions({ touchAction: 'none' });
    }
  },

  /*
  * id - Monitor ID
  * !!! On Montage & Watch page, when you hover over a block of buttons (in the empty space between the buttons themselves), the cursor changes, but no action occurs, you need to review "monitors[i]||monitorStream.setup_onclick(handleClick)"
  */
  manageCursor: function(id) {
    if (!this.panZoom[id]) {
      console.log(`PanZoom for monitor ID=${id} was not initialized.`);
      return;
    }
    var obj;
    var obj_btn;
    const disablePan = this.panZoom[id].getOptions().disablePan;
    const disableZoom = this.panZoom[id].getOptions().disableZoom;

    obj = this.getStream(id);
    if (obj) { //Montage & Watch page
      obj_btn = document.getElementById('button_zoom'+id); //Change the cursor when you hover over the block of buttons at the top of the image. Not required on Event page
    } else { //Event page
      obj = document.getElementById('videoFeedStream'+id);
    }

    if (!obj) {
      console.log(`Stream with id=${id} not found.`);
      return;
    }
    const currentScale = this.panZoom[id].getScale().toFixed(1);

    if (this.shifted && this.ctrled) {
      const cursor = (disableZoom) ? 'auto' : 'zoom-out';
      obj.style['cursor'] = cursor;
      if (obj_btn) {
        obj_btn.style['cursor'] = cursor;
      }
    } else if (this.shifted) {
      const cursor = (disableZoom) ? 'auto' : 'zoom-in';
      obj.style['cursor'] = cursor;
      if (obj_btn) {
        obj_btn.style['cursor'] = cursor;
      }
    } else if (this.ctrled) {
      if (currentScale == 1.0) {
        obj.style['cursor'] = 'auto';
        if (obj_btn) {
          obj_btn.style['cursor'] = 'auto';
        }
      } else {
        const cursor = (disableZoom) ? 'auto' : 'zoom-out';
        obj.style['cursor'] = cursor;
        if (obj_btn) {
          obj_btn.style['cursor'] = cursor;
        }
      }
    } else { //No ctrled & no shifted
      if (currentScale == 1.0) {
        obj.style['cursor'] = 'auto';
        if (obj_btn) {
          obj_btn.style['cursor'] = 'auto';
        }
      } else {
        const cursor = (disablePan) ? 'auto' : 'move';
        obj.style['cursor'] = cursor;
        if (obj_btn) {
          obj_btn.style['cursor'] = cursor;
        }
      }
    }
  },

  click: function(id) {
    if (this.ctrled && this.shifted) {
      this.panZoom[id].zoom(1, {animate: true});
    } else if (this.ctrled) {
      this.panZoom[id].zoomOut();
    } else if (this.shifted) {
      const scale = this.panZoom[id].getScale() * Math.exp(this.panZoomStep);
      const point = {clientX: event.clientX, clientY: event.clientY};
      this.panZoom[id].zoomToPoint(scale, point, {focal: {x: event.clientX, y: event.clientY}});
    }
    if (this.ctrled || this.shifted) {
      this.setTriggerChangedMonitors(id);
    }
    this.setTouchAction(this.panZoom[id]);
  },

  getStream: function(id) {
    if (isNaN(id)) {
      const liveStream = $j(id).find('[id ^= "liveStream"]');
      const evtStream = $j(id).find('[id ^= "evtStream"]');
      return (liveStream.length > 0) ? liveStream : evtStream;
    } else {
      const liveStream = document.getElementById('liveStream'+id);
      const evtStream = document.getElementById('evtStream'+id);
      return (liveStream) ? liveStream : evtStream;
    }
  },

  setTriggerChangedMonitors: function(id) {
    if (typeof setTriggerChangedMonitors !== 'undefined' && $j.isFunction(setTriggerChangedMonitors)) {
      //Montage page
      setTriggerChangedMonitors(id);
    } else {
      // Event page
      updateScale = true;
    }
  }
};

function handlePanZoomEventMousemove(event) {
  if (typeof panZoomEventMousemove !== 'undefined' && $j.isFunction(panZoomEventMousemove)) panZoomEventMousemove(event);
}

function handlePanZoomEventPanzoomchange(event) {
  if (typeof panZoomEventPanzoomchange !== 'undefined' && $j.isFunction(panZoomEventPanzoomchange)) panZoomEventPanzoomchange(event);
  //console.log('panzoomchange', event.detail) // => { x: 0, y: 0, scale: 1 }
}

function handlePanZoomEventPanzoomzoom(event) {
  if (typeof panZoomEventPanzoomzoom !== 'undefined' && $j.isFunction(panZoomEventPanzoomzoom)) panZoomEventPanzoomzoom(event);
}

function handlePanZoomEventPanzoomstart(event) {
  if (typeof panZoomEventPanzoomstart !== 'undefined' && $j.isFunction(panZoomEventPanzoomstart)) panZoomEventPanzoomstart(event);
}

function handlePanzoompan(event) {
  if (typeof panZoomEventPanzoompan !== 'undefined' && $j.isFunction(panZoomEventPanzoompan)) panZoomEventPanzoompan(event);
}

function handlePanzoomend(event) {
  if (typeof panZoomEventPanzoomend !== 'undefined' && $j.isFunction(panZoomEventPanzoomend)) panZoomEventPanzoomend(event);
}

function handlePanzoomreset(event) {
  if (typeof panZoomEventPanzoomreset !== 'undefined' && $j.isFunction(panZoomEventPanzoomreset)) panZoomEventPanzoomreset(event);
}
