
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        const updates = [];
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                // defer updates until all the DOM shuffling is done
                updates.push(() => block.p(child_ctx, dirty));
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        run_all(updates);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.58.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    function commonjsRequire (target) {
    	throw new Error('Could not dynamically require "' + target + '". Please configure the dynamicRequireTargets option of @rollup/plugin-commonjs appropriately for this require call to behave properly.');
    }

    var gun = createCommonjsModule(function (module) {
    (function(){

      /* UNBUILD */
      function USE(arg, req){
        return req? commonjsRequire(arg) : arg.slice? USE[R(arg)] : function(mod, path){
          arg(mod = {exports: {}});
          USE[R(path)] = mod.exports;
        }
        function R(p){
          return p.split('/').slice(-1).toString().replace('.js','');
        }
      }
      { var MODULE = module; }
    USE(function(module){
    		// Shim for generic javascript utilities.
    		String.random = function(l, c){
    			var s = '';
    			l = l || 24; // you are not going to make a 0 length random number, so no need to check type
    			c = c || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXZabcdefghijklmnopqrstuvwxyz';
    			while(l-- > 0){ s += c.charAt(Math.floor(Math.random() * c.length)); }
    			return s;
    		};
    		String.match = function(t, o){ var tmp, u;
    			if('string' !== typeof t){ return false }
    			if('string' == typeof o){ o = {'=': o}; }
    			o = o || {};
    			tmp = (o['='] || o['*'] || o['>'] || o['<']);
    			if(t === tmp){ return true }
    			if(u !== o['=']){ return false }
    			tmp = (o['*'] || o['>']);
    			if(t.slice(0, (tmp||'').length) === tmp){ return true }
    			if(u !== o['*']){ return false }
    			if(u !== o['>'] && u !== o['<']){
    				return (t >= o['>'] && t <= o['<'])? true : false;
    			}
    			if(u !== o['>'] && t >= o['>']){ return true }
    			if(u !== o['<'] && t <= o['<']){ return true }
    			return false;
    		};
    		String.hash = function(s, c){ // via SO
    			if(typeof s !== 'string'){ return }
    	    c = c || 0; // CPU schedule hashing by
    	    if(!s.length){ return c }
    	    for(var i=0,l=s.length,n; i<l; ++i){
    	      n = s.charCodeAt(i);
    	      c = ((c<<5)-c)+n;
    	      c |= 0;
    	    }
    	    return c;
    	  };
    		var has = Object.prototype.hasOwnProperty;
    		Object.plain = function(o){ return o? (o instanceof Object && o.constructor === Object) || Object.prototype.toString.call(o).match(/^\[object (\w+)\]$/)[1] === 'Object' : false };
    		Object.empty = function(o, n){
    			for(var k in o){ if(has.call(o, k) && (!n || -1==n.indexOf(k))){ return false } }
    			return true;
    		};
    		Object.keys = Object.keys || function(o){
    			var l = [];
    			for(var k in o){ if(has.call(o, k)){ l.push(k); } }
    			return l;
    		}
    		;(function(){
    			var u, sT = setTimeout, l = 0, c = 0
    			, sI = (typeof setImmediate !== ''+u && setImmediate) || (function(c,f){
    				if(typeof MessageChannel == ''+u){ return sT }
    				(c = new MessageChannel()).port1.onmessage = function(e){ ''==e.data && f(); };
    				return function(q){ f=q;c.port2.postMessage(''); }
    			}()), check = sT.check = sT.check || (typeof performance !== ''+u && performance)
    			|| {now: function(){ return +new Date }};
    			sT.hold = sT.hold || 9; // half a frame benchmarks faster than < 1ms?
    			sT.poll = sT.poll || function(f){
    				if((sT.hold >= (check.now() - l)) && c++ < 3333){ f(); return }
    				sI(function(){ l = check.now(); f(); },c=0);
    			};
    		}());
    (function(){ // Too many polls block, this "threads" them in turns over a single thread in time.
    			var sT = setTimeout, t = sT.turn = sT.turn || function(f){ 1 == s.push(f) && p(T); }
    			, s = t.s = [], p = sT.poll, i = 0, f, T = function(){
    				if(f = s[i++]){ f(); }
    				if(i == s.length || 99 == i){
    					s = t.s = s.slice(i);
    					i = 0;
    				}
    				if(s.length){ p(T); }
    			};
    		}());
    (function(){
    			var u, sT = setTimeout, T = sT.turn;
    			(sT.each = sT.each || function(l,f,e,S){ S = S || 9; (function t(s,L,r){
    			  if(L = (s = (l||[]).splice(0,S)).length){
    			  	for(var i = 0; i < L; i++){
    			  		if(u !== (r = f(s[i]))){ break }
    			  	}
    			  	if(u === r){ T(t); return }
    			  } e && e(r);
    			}());})();
    		}());
    	})(USE, './shim');
    USE(function(module){
    		// On event emitter generic javascript utility.
    		module.exports = function onto(tag, arg, as){
    			if(!tag){ return {to: onto} }
    			var u, f = 'function' == typeof arg, tag = (this.tag || (this.tag = {}))[tag] || f && (
    				this.tag[tag] = {tag: tag, to: onto._ = { next: function(arg){ var tmp;
    					if(tmp = this.to){ tmp.next(arg); }
    			}}});
    			if(f){
    				var be = {
    					off: onto.off ||
    					(onto.off = function(){
    						if(this.next === onto._.next){ return !0 }
    						if(this === this.the.last){
    							this.the.last = this.back;
    						}
    						this.to.back = this.back;
    						this.next = onto._.next;
    						this.back.to = this.to;
    						if(this.the.last === this.the){
    							delete this.on.tag[this.the.tag];
    						}
    					}),
    					to: onto._,
    					next: arg,
    					the: tag,
    					on: this,
    					as: as,
    				};
    				(be.back = tag.last || tag).to = be;
    				return tag.last = be;
    			}
    			if((tag = tag.to) && u !== arg){ tag.next(arg); }
    			return tag;
    		};
    	})(USE, './onto');
    USE(function(module){
    		// Valid values are a subset of JSON: null, binary, number (!Infinity), text,
    		// or a soul relation. Arrays need special algorithms to handle concurrency,
    		// so they are not supported directly. Use an extension that supports them if
    		// needed but research their problems first.
    		module.exports = function (v) {
    		  // "deletes", nulling out keys.
    		  return v === null ||
    			"string" === typeof v ||
    			"boolean" === typeof v ||
    			// we want +/- Infinity to be, but JSON does not support it, sad face.
    			// can you guess what v === v checks for? ;)
    			("number" === typeof v && v != Infinity && v != -Infinity && v === v) ||
    			(!!v && "string" == typeof v["#"] && Object.keys(v).length === 1 && v["#"]);
    		};
    	})(USE, './valid');
    USE(function(module){
    		USE('./shim');
    		function State(){
    			var t = +new Date;
    			if(last < t){
    				return N = 0, last = t + State.drift;
    			}
    			return last = t + ((N += 1) / D) + State.drift;
    		}
    		State.drift = 0;
    		var NI = -Infinity, N = 0, D = 999, last = NI, u; // WARNING! In the future, on machines that are D times faster than 2016AD machines, you will want to increase D by another several orders of magnitude so the processing speed never out paces the decimal resolution (increasing an integer effects the state accuracy).
    		State.is = function(n, k, o){ // convenience function to get the state on a key on a node and return it.
    			var tmp = (k && n && n._ && n._['>']) || o;
    			if(!tmp){ return }
    			return ('number' == typeof (tmp = tmp[k]))? tmp : NI;
    		};
    		State.ify = function(n, k, s, v, soul){ // put a key's state on a node.
    			(n = n || {})._ = n._ || {}; // safety check or init.
    			if(soul){ n._['#'] = soul; } // set a soul if specified.
    			var tmp = n._['>'] || (n._['>'] = {}); // grab the states data.
    			if(u !== k && k !== '_'){
    				if('number' == typeof s){ tmp[k] = s; } // add the valid state.
    				if(u !== v){ n[k] = v; } // Note: Not its job to check for valid values!
    			}
    			return n;
    		};
    		module.exports = State;
    	})(USE, './state');
    USE(function(module){
    		USE('./shim');
    		function Dup(opt){
    			var dup = {s:{}}, s = dup.s;
    			opt = opt || {max: 999, age: 1000 * 9};//*/ 1000 * 9 * 3};
    			dup.check = function(id){
    				if(!s[id]){ return false }
    				return dt(id);
    			};
    			var dt = dup.track = function(id){
    				var it = s[id] || (s[id] = {});
    				it.was = dup.now = +new Date;
    				if(!dup.to){ dup.to = setTimeout(dup.drop, opt.age + 9); }
    				if(dt.ed){ dt.ed(id); }
    				return it;
    			};
    			dup.drop = function(age){
    				dup.to = null;
    				dup.now = +new Date;
    				var l = Object.keys(s);
    				console.STAT && console.STAT(dup.now, +new Date - dup.now, 'dup drop keys'); // prev ~20% CPU 7% RAM 300MB // now ~25% CPU 7% RAM 500MB
    				setTimeout.each(l, function(id){ var it = s[id]; // TODO: .keys( is slow?
    					if(it && (age || opt.age) > (dup.now - it.was)){ return }
    					delete s[id];
    				},0,99);
    			};
    			return dup;
    		}
    		module.exports = Dup;
    	})(USE, './dup');
    USE(function(module){
    		// request / response module, for asking and acking messages.
    		USE('./onto'); // depends upon onto!
    		module.exports = function ask(cb, as){
    			if(!this.on){ return }
    			var lack = (this.opt||{}).lack || 9000;
    			if(!('function' == typeof cb)){
    				if(!cb){ return }
    				var id = cb['#'] || cb, tmp = (this.tag||'')[id];
    				if(!tmp){ return }
    				if(as){
    					tmp = this.on(id, as);
    					clearTimeout(tmp.err);
    					tmp.err = setTimeout(function(){ tmp.off(); }, lack);
    				}
    				return true;
    			}
    			var id = (as && as['#']) || random(9);
    			if(!cb){ return id }
    			var to = this.on(id, cb, as);
    			to.err = to.err || setTimeout(function(){ to.off();
    				to.next({err: "Error: No ACK yet.", lack: true});
    			}, lack);
    			return id;
    		};
    		var random = String.random || function(){ return Math.random().toString(36).slice(2) };
    	})(USE, './ask');
    USE(function(module){

    		function Gun(o){
    			if(o instanceof Gun){ return (this._ = {$: this}).$ }
    			if(!(this instanceof Gun)){ return new Gun(o) }
    			return Gun.create(this._ = {$: this, opt: o});
    		}

    		Gun.is = function($){ return ($ instanceof Gun) || ($ && $._ && ($ === $._.$)) || false };

    		Gun.version = 0.2020;

    		Gun.chain = Gun.prototype;
    		Gun.chain.toJSON = function(){};

    		USE('./shim');
    		Gun.valid = USE('./valid');
    		Gun.state = USE('./state');
    		Gun.on = USE('./onto');
    		Gun.dup = USE('./dup');
    		Gun.ask = USE('./ask');
    (function(){
    			Gun.create = function(at){
    				at.root = at.root || at;
    				at.graph = at.graph || {};
    				at.on = at.on || Gun.on;
    				at.ask = at.ask || Gun.ask;
    				at.dup = at.dup || Gun.dup();
    				var gun = at.$.opt(at.opt);
    				if(!at.once){
    					at.on('in', universe, at);
    					at.on('out', universe, at);
    					at.on('put', map, at);
    					Gun.on('create', at);
    					at.on('create', at);
    				}
    				at.once = 1;
    				return gun;
    			};
    			function universe(msg){
    				// TODO: BUG! msg.out = null being set!
    				//if(!F){ var eve = this; setTimeout(function(){ universe.call(eve, msg,1) },Math.random() * 100);return; } // ADD F TO PARAMS!
    				if(!msg){ return }
    				if(msg.out === universe){ this.to.next(msg); return }
    				var eve = this, as = eve.as, at = as.at || as, gun = at.$, dup = at.dup, tmp, DBG = msg.DBG;
    				(tmp = msg['#']) || (tmp = msg['#'] = text_rand(9));
    				if(dup.check(tmp)){ return } dup.track(tmp);
    				tmp = msg._; msg._ = ('function' == typeof tmp)? tmp : function(){};
    				(msg.$ && (msg.$ === (msg.$._||'').$)) || (msg.$ = gun);
    				if(msg['@'] && !msg.put){ ack(msg); }
    				if(!at.ask(msg['@'], msg)){ // is this machine listening for an ack?
    					DBG && (DBG.u = +new Date);
    					if(msg.put){ put(msg); return } else
    					if(msg.get){ Gun.on.get(msg, gun); }
    				}
    				DBG && (DBG.uc = +new Date);
    				eve.to.next(msg);
    				DBG && (DBG.ua = +new Date);
    				if(msg.nts || msg.NTS){ return } // TODO: This shouldn't be in core, but fast way to prevent NTS spread. Delete this line after all peers have upgraded to newer versions.
    				msg.out = universe; at.on('out', msg);
    				DBG && (DBG.ue = +new Date);
    			}
    			function put(msg){
    				if(!msg){ return }
    				var ctx = msg._||'', root = ctx.root = ((ctx.$ = msg.$||'')._||'').root;
    				if(msg['@'] && ctx.faith && !ctx.miss){ // TODO: AXE may split/route based on 'put' what should we do here? Detect @ in AXE? I think we don't have to worry, as DAM will route it on @.
    					msg.out = universe;
    					root.on('out', msg);
    					return;
    				}
    				ctx.latch = root.hatch; ctx.match = root.hatch = [];
    				var put = msg.put;
    				var DBG = ctx.DBG = msg.DBG, S = +new Date; CT = CT || S;
    				if(put['#'] && put['.']){ /*root && root.on('put', msg);*/ return } // TODO: BUG! This needs to call HAM instead.
    				DBG && (DBG.p = S);
    				ctx['#'] = msg['#'];
    				ctx.msg = msg;
    				ctx.all = 0;
    				ctx.stun = 1;
    				var nl = Object.keys(put);//.sort(); // TODO: This is unbounded operation, large graphs will be slower. Write our own CPU scheduled sort? Or somehow do it in below? Keys itself is not O(1) either, create ES5 shim over ?weak map? or custom which is constant.
    				console.STAT && console.STAT(S, ((DBG||ctx).pk = +new Date) - S, 'put sort');
    				var ni = 0, nj, kl, soul, node, states, err, tmp;
    				(function pop(o){
    					if(nj != ni){ nj = ni;
    						if(!(soul = nl[ni])){
    							console.STAT && console.STAT(S, ((DBG||ctx).pd = +new Date) - S, 'put');
    							fire(ctx);
    							return;
    						}
    						if(!(node = put[soul])){ err = ERR+cut(soul)+"no node."; } else
    						if(!(tmp = node._)){ err = ERR+cut(soul)+"no meta."; } else
    						if(soul !== tmp['#']){ err = ERR+cut(soul)+"soul not same."; } else
    						if(!(states = tmp['>'])){ err = ERR+cut(soul)+"no state."; }
    						kl = Object.keys(node||{}); // TODO: .keys( is slow
    					}
    					if(err){
    						msg.err = ctx.err = err; // invalid data should error and stun the message.
    						fire(ctx);
    						//console.log("handle error!", err) // handle!
    						return;
    					}
    					var i = 0, key; o = o || 0;
    					while(o++ < 9 && (key = kl[i++])){
    						if('_' === key){ continue }
    						var val = node[key], state = states[key];
    						if(u === state){ err = ERR+cut(key)+"on"+cut(soul)+"no state."; break }
    						if(!valid(val)){ err = ERR+cut(key)+"on"+cut(soul)+"bad "+(typeof val)+cut(val); break }
    						//ctx.all++; //ctx.ack[soul+key] = '';
    						ham(val, key, soul, state, msg);
    						++C; // courtesy count;
    					}
    					if((kl = kl.slice(i)).length){ turn(pop); return }
    					++ni; kl = null; pop(o);
    				}());
    			} Gun.on.put = put;
    			// TODO: MARK!!! clock below, reconnect sync, SEA certify wire merge, User.auth taking multiple times, // msg put, put, say ack, hear loop...
    			// WASIS BUG! local peer not ack. .off other people: .open
    			function ham(val, key, soul, state, msg){
    				var ctx = msg._||'', root = ctx.root, graph = root.graph, tmp;
    				var vertex = graph[soul] || empty, was = state_is(vertex, key, 1), known = vertex[key];
    				
    				var DBG = ctx.DBG; if(tmp = console.STAT){ if(!graph[soul] || !known){ tmp.has = (tmp.has || 0) + 1; } }

    				var now = State();
    				if(state > now){
    					setTimeout(function(){ ham(val, key, soul, state, msg); }, (tmp = state - now) > MD? MD : tmp); // Max Defer 32bit. :(
    					console.STAT && console.STAT(((DBG||ctx).Hf = +new Date), tmp, 'future');
    					return;
    				}
    				if(state < was){ /*old;*/ { return } } // but some chains have a cache miss that need to re-fire. // TODO: Improve in future. // for AXE this would reduce rebroadcast, but GUN does it on message forwarding. // TURNS OUT CACHE MISS WAS NOT NEEDED FOR NEW CHAINS ANYMORE!!! DANGER DANGER DANGER, ALWAYS RETURN! (or am I missing something?)
    				if(!ctx.faith){ // TODO: BUG? Can this be used for cache miss as well? // Yes this was a bug, need to check cache miss for RAD tests, but should we care about the faith check now? Probably not.
    					if(state === was && (val === known || L(val) <= L(known))){ /*console.log("same");*/ /*same;*/ if(!ctx.miss){ return } } // same
    				}
    				ctx.stun++; // TODO: 'forget' feature in SEA tied to this, bad approach, but hacked in for now. Any changes here must update there.
    				var aid = msg['#']+ctx.all++, id = {toString: function(){ return aid }, _: ctx}; id.toJSON = id.toString; // this *trick* makes it compatible between old & new versions.
    				root.dup.track(id)['#'] = msg['#']; // fixes new OK acks for RPC like RTC.
    				DBG && (DBG.ph = DBG.ph || +new Date);
    				root.on('put', {'#': id, '@': msg['@'], put: {'#': soul, '.': key, ':': val, '>': state}, ok: msg.ok, _: ctx});
    			}
    			function map(msg){
    				var DBG; if(DBG = (msg._||'').DBG){ DBG.pa = +new Date; DBG.pm = DBG.pm || +new Date;}
          	var eve = this, root = eve.as, graph = root.graph, ctx = msg._, put = msg.put, soul = put['#'], key = put['.'], val = put[':'], state = put['>']; msg['#']; var tmp;
          	if((tmp = ctx.msg) && (tmp = tmp.put) && (tmp = tmp[soul])){ state_ify(tmp, key, state, val, soul); } // necessary! or else out messages do not get SEA transforms.
          	//var bytes = ((graph[soul]||'')[key]||'').length||1;
    				graph[soul] = state_ify(graph[soul], key, state, val, soul);
    				if(tmp = (root.next||'')[soul]){
    					//tmp.bytes = (tmp.bytes||0) + ((val||'').length||1) - bytes;
    					//if(tmp.bytes > 2**13){ Gun.log.once('byte-limit', "Note: In the future, GUN peers will enforce a ~4KB query limit. Please see https://gun.eco/docs/Page") }
    					tmp.on('in', msg);
    				}
    				fire(ctx);
    				eve.to.next(msg);
    			}
    			function fire(ctx, msg){ var root;
    				if(ctx.stop){ return }
    				if(!ctx.err && 0 < --ctx.stun){ return } // TODO: 'forget' feature in SEA tied to this, bad approach, but hacked in for now. Any changes here must update there.
    				ctx.stop = 1;
    				if(!(root = ctx.root)){ return }
    				var tmp = ctx.match; tmp.end = 1;
    				if(tmp === root.hatch){ if(!(tmp = ctx.latch) || tmp.end){ delete root.hatch; } else { root.hatch = tmp; } }
    				ctx.hatch && ctx.hatch(); // TODO: rename/rework how put & this interact.
    				setTimeout.each(ctx.match, function(cb){cb && cb();}); 
    				if(!(msg = ctx.msg) || ctx.err || msg.err){ return }
    				msg.out = universe;
    				ctx.root.on('out', msg);

    				CF(); // courtesy check;
    			}
    			function ack(msg){ // aggregate ACKs.
    				var id = msg['@'] || '', ctx;
    				if(!(ctx = id._)){
    					var dup = (dup = msg.$) && (dup = dup._) && (dup = dup.root) && (dup = dup.dup);
    					if(!(dup = dup.check(id))){ return }
    					msg['@'] = dup['#'] || msg['@']; // This doesn't do anything anymore, backtrack it to something else?
    					return;
    				}
    				ctx.acks = (ctx.acks||0) + 1;
    				if(ctx.err = msg.err){
    					msg['@'] = ctx['#'];
    					fire(ctx); // TODO: BUG? How it skips/stops propagation of msg if any 1 item is error, this would assume a whole batch/resync has same malicious intent.
    				}
    				ctx.ok = msg.ok || ctx.ok;
    				if(!ctx.stop && !ctx.crack){ ctx.crack = ctx.match && ctx.match.push(function(){back(ctx);}); } // handle synchronous acks. NOTE: If a storage peer ACKs synchronously then the PUT loop has not even counted up how many items need to be processed, so ctx.STOP flags this and adds only 1 callback to the end of the PUT loop.
    				back(ctx);
    			}
    			function back(ctx){
    				if(!ctx || !ctx.root){ return }
    				if(ctx.stun || ctx.acks !== ctx.all){ return }
    				ctx.root.on('in', {'@': ctx['#'], err: ctx.err, ok: ctx.err? u : ctx.ok || {'':1}});
    			}

    			var ERR = "Error: Invalid graph!";
    			var cut = function(s){ return " '"+(''+s).slice(0,9)+"...' " };
    			var L = JSON.stringify, MD = 2147483647, State = Gun.state;
    			var C = 0, CT, CF = function(){if(C>999 && (C/-(CT - (CT = +new Date))>1)){Gun.window && console.log("Warning: You're syncing 1K+ records a second, faster than DOM can update - consider limiting query.");CF=function(){C=0;};}};

    		}());
    (function(){
    			Gun.on.get = function(msg, gun){
    				var root = gun._, get = msg.get, soul = get['#'], node = root.graph[soul], has = get['.'];
    				var next = root.next || (root.next = {}), at = next[soul];

    				// TODO: Azarattum bug, what is in graph is not same as what is in next. Fix!

    				// queue concurrent GETs?
    				// TODO: consider tagging original message into dup for DAM.
    				// TODO: ^ above? In chat app, 12 messages resulted in same peer asking for `#user.pub` 12 times. (same with #user GET too, yipes!) // DAM note: This also resulted in 12 replies from 1 peer which all had same ##hash but none of them deduped because each get was different.
    				// TODO: Moving quick hacks fixing these things to axe for now.
    				// TODO: a lot of GET #foo then GET #foo."" happening, why?
    				// TODO: DAM's ## hash check, on same get ACK, producing multiple replies still, maybe JSON vs YSON?
    				// TMP note for now: viMZq1slG was chat LEX query #.
    				/*if(gun !== (tmp = msg.$) && (tmp = (tmp||'')._)){
    					if(tmp.Q){ tmp.Q[msg['#']] = ''; return } // chain does not need to ask for it again.
    					tmp.Q = {};
    				}*/
    				/*if(u === has){
    					if(at.Q){
    						//at.Q[msg['#']] = '';
    						//return;
    					}
    					at.Q = {};
    				}*/
    				var ctx = msg._||{}, DBG = ctx.DBG = msg.DBG;
    				DBG && (DBG.g = +new Date);
    				//console.log("GET:", get, node, has, at);
    				//if(!node && !at){ return root.on('get', msg) }
    				//if(has && node){ // replace 2 below lines to continue dev?
    				if(!node){ return root.on('get', msg) }
    				if(has){
    					if('string' != typeof has || u === node[has]){
    						if(!((at||'').next||'')[has]){ root.on('get', msg); return }
    					}
    					node = state_ify({}, has, state_is(node, has), node[has], soul);
    					// If we have a key in-memory, do we really need to fetch?
    					// Maybe... in case the in-memory key we have is a local write
    					// we still need to trigger a pull/merge from peers.
    				}
    				//Gun.window? Gun.obj.copy(node) : node; // HNPERF: If !browser bump Performance? Is this too dangerous to reference root graph? Copy / shallow copy too expensive for big nodes. Gun.obj.to(node); // 1 layer deep copy // Gun.obj.copy(node); // too slow on big nodes
    				node && ack(msg, node);
    				root.on('get', msg); // send GET to storage adapters.
    			};
    			function ack(msg, node){
    				var S = +new Date, ctx = msg._||{}, DBG = ctx.DBG = msg.DBG;
    				var to = msg['#'], id = text_rand(9), keys = Object.keys(node||'').sort(), soul = ((node||'')._||'')['#']; keys.length; var root = msg.$._.root, F = (node === root.graph[soul]);
    				console.STAT && console.STAT(S, ((DBG||ctx).gk = +new Date) - S, 'got keys');
    				// PERF: Consider commenting this out to force disk-only reads for perf testing? // TODO: .keys( is slow
    				node && (function go(){
    					S = +new Date;
    					var i = 0, k, put = {}, tmp;
    					while(i < 9 && (k = keys[i++])){
    						state_ify(put, k, state_is(node, k), node[k], soul);
    					}
    					keys = keys.slice(i);
    					(tmp = {})[soul] = put; put = tmp;
    					var faith; if(F){ faith = function(){}; faith.ram = faith.faith = true; } // HNPERF: We're testing performance improvement by skipping going through security again, but this should be audited.
    					tmp = keys.length;
    					console.STAT && console.STAT(S, -(S - (S = +new Date)), 'got copied some');
    					DBG && (DBG.ga = +new Date);
    					root.on('in', {'@': to, '#': id, put: put, '%': (tmp? (id = text_rand(9)) : u), $: root.$, _: faith, DBG: DBG, FOO: 1});
    					console.STAT && console.STAT(S, +new Date - S, 'got in');
    					if(!tmp){ return }
    					setTimeout.turn(go);
    				}());
    				if(!node){ root.on('in', {'@': msg['#']}); } // TODO: I don't think I like this, the default lS adapter uses this but "not found" is a sensitive issue, so should probably be handled more carefully/individually.
    			} Gun.on.get.ack = ack;
    		}());
    (function(){
    			Gun.chain.opt = function(opt){
    				opt = opt || {};
    				var gun = this, at = gun._, tmp = opt.peers || opt;
    				if(!Object.plain(opt)){ opt = {}; }
    				if(!Object.plain(at.opt)){ at.opt = opt; }
    				if('string' == typeof tmp){ tmp = [tmp]; }
    				if(!Object.plain(at.opt.peers)){ at.opt.peers = {};}
    				if(tmp instanceof Array){
    					opt.peers = {};
    					tmp.forEach(function(url){
    						var p = {}; p.id = p.url = url;
    						opt.peers[url] = at.opt.peers[url] = at.opt.peers[url] || p;
    					});
    				}
    				obj_each(opt, function each(k){ var v = this[k];
    					if((this && this.hasOwnProperty(k)) || 'string' == typeof v || Object.empty(v)){ this[k] = v; return }
    					if(v && v.constructor !== Object && !(v instanceof Array)){ return }
    					obj_each(v, each);
    				});
    				at.opt.from = opt;
    				Gun.on('opt', at);
    				at.opt.uuid = at.opt.uuid || function uuid(l){ return Gun.state().toString(36).replace('.','') + String.random(l||12) };
    				return gun;
    			};
    		}());

    		var obj_each = function(o,f){ Object.keys(o).forEach(f,o); }, text_rand = String.random, turn = setTimeout.turn, valid = Gun.valid, state_is = Gun.state.is, state_ify = Gun.state.ify, u, empty = {}, C;

    		Gun.log = function(){ return (!Gun.log.off && C.log.apply(C, arguments)), [].slice.call(arguments).join(' ') };
    		Gun.log.once = function(w,s,o){ return (o = Gun.log.once)[w] = o[w] || 0, o[w]++ || Gun.log(s) };

    		if(typeof window !== "undefined"){ (window.GUN = window.Gun = Gun).window = window; }
    		try{ if(typeof MODULE !== "undefined"){ MODULE.exports = Gun; } }catch(e){}
    		module.exports = Gun;
    		
    		(Gun.window||{}).console = (Gun.window||{}).console || {log: function(){}};
    		(C = console).only = function(i, s){ return (C.only.i && i === C.only.i && C.only.i++) && (C.log.apply(C, arguments) || s) };
    		Gun.log.once("welcome", "Hello wonderful person! :) Thanks for using GUN, please ask for help on http://chat.gun.eco if anything takes you longer than 5min to figure out!");
    	})(USE, './root');
    USE(function(module){
    		var Gun = USE('./root');
    		Gun.chain.back = function(n, opt){ var tmp;
    			n = n || 1;
    			if(-1 === n || Infinity === n){
    				return this._.root.$;
    			} else
    			if(1 === n){
    				return (this._.back || this._).$;
    			}
    			var gun = this, at = gun._;
    			if(typeof n === 'string'){
    				n = n.split('.');
    			}
    			if(n instanceof Array){
    				var i = 0, l = n.length, tmp = at;
    				for(i; i < l; i++){
    					tmp = (tmp||empty)[n[i]];
    				}
    				if(u !== tmp){
    					return opt? gun : tmp;
    				} else
    				if((tmp = at.back)){
    					return tmp.$.back(n, opt);
    				}
    				return;
    			}
    			if('function' == typeof n){
    				var yes, tmp = {back: at};
    				while((tmp = tmp.back)
    				&& u === (yes = n(tmp, opt))){}
    				return yes;
    			}
    			if('number' == typeof n){
    				return (at.back || at).$.back(n - 1);
    			}
    			return this;
    		};
    		var empty = {}, u;
    	})(USE, './back');
    USE(function(module){
    		// WARNING: GUN is very simple, but the JavaScript chaining API around GUN
    		// is complicated and was extremely hard to build. If you port GUN to another
    		// language, consider implementing an easier API to build.
    		var Gun = USE('./root');
    		Gun.chain.chain = function(sub){
    			var gun = this, at = gun._, chain = new (sub || gun).constructor(gun), cat = chain._, root;
    			cat.root = root = at.root;
    			cat.id = ++root.once;
    			cat.back = gun._;
    			cat.on = Gun.on;
    			cat.on('in', Gun.on.in, cat); // For 'in' if I add my own listeners to each then I MUST do it before in gets called. If I listen globally for all incoming data instead though, regardless of individual listeners, I can transform the data there and then as well.
    			cat.on('out', Gun.on.out, cat); // However for output, there isn't really the global option. I must listen by adding my own listener individually BEFORE this one is ever called.
    			return chain;
    		};

    		function output(msg){
    			var get, at = this.as, back = at.back, root = at.root, tmp;
    			if(!msg.$){ msg.$ = at.$; }
    			this.to.next(msg);
    			if(at.err){ at.on('in', {put: at.put = u, $: at.$}); return }
    			if(get = msg.get){
    				/*if(u !== at.put){
    					at.on('in', at);
    					return;
    				}*/
    				if(root.pass){ root.pass[at.id] = at; } // will this make for buggy behavior elsewhere?
    				if(at.lex){ Object.keys(at.lex).forEach(function(k){ tmp[k] = at.lex[k]; }, tmp = msg.get = msg.get || {}); }
    				if(get['#'] || at.soul){
    					get['#'] = get['#'] || at.soul;
    					//root.graph[get['#']] = root.graph[get['#']] || {_:{'#':get['#'],'>':{}}};
    					msg['#'] || (msg['#'] = text_rand(9)); // A3120 ?
    					back = (root.$.get(get['#'])._);
    					if(!(get = get['.'])){ // soul
    						tmp = back.ask && back.ask['']; // check if we have already asked for the full node
    						(back.ask || (back.ask = {}))[''] = back; // add a flag that we are now.
    						if(u !== back.put){ // if we already have data,
    							back.on('in', back); // send what is cached down the chain
    							if(tmp){ return } // and don't ask for it again.
    						}
    						msg.$ = back.$;
    					} else
    					if(obj_has(back.put, get)){ // TODO: support #LEX !
    						tmp = back.ask && back.ask[get];
    						(back.ask || (back.ask = {}))[get] = back.$.get(get)._;
    						back.on('in', {get: get, put: {'#': back.soul, '.': get, ':': back.put[get], '>': state_is(root.graph[back.soul], get)}});
    						if(tmp){ return }
    					}
    						/*put = (back.$.get(get)._);
    						if(!(tmp = put.ack)){ put.ack = -1 }
    						back.on('in', {
    							$: back.$,
    							put: Gun.state.ify({}, get, Gun.state(back.put, get), back.put[get]),
    							get: back.get
    						});
    						if(tmp){ return }
    					} else
    					if('string' != typeof get){
    						var put = {}, meta = (back.put||{})._;
    						Gun.obj.map(back.put, function(v,k){
    							if(!Gun.text.match(k, get)){ return }
    							put[k] = v;
    						})
    						if(!Gun.obj.empty(put)){
    							put._ = meta;
    							back.on('in', {$: back.$, put: put, get: back.get})
    						}
    						if(tmp = at.lex){
    							tmp = (tmp._) || (tmp._ = function(){});
    							if(back.ack < tmp.ask){ tmp.ask = back.ack }
    							if(tmp.ask){ return }
    							tmp.ask = 1;
    						}
    					}
    					*/
    					root.ask(ack, msg); // A3120 ?
    					return root.on('in', msg);
    				}
    				//if(root.now){ root.now[at.id] = root.now[at.id] || true; at.pass = {} }
    				if(get['.']){
    					if(at.get){
    						msg = {get: {'.': at.get}, $: at.$};
    						(back.ask || (back.ask = {}))[at.get] = msg.$._; // TODO: PERFORMANCE? More elegant way?
    						return back.on('out', msg);
    					}
    					msg = {get: at.lex? msg.get : {}, $: at.$};
    					return back.on('out', msg);
    				}
    				(at.ask || (at.ask = {}))[''] = at;	 //at.ack = at.ack || -1;
    				if(at.get){
    					get['.'] = at.get;
    					(back.ask || (back.ask = {}))[at.get] = msg.$._; // TODO: PERFORMANCE? More elegant way?
    					return back.on('out', msg);
    				}
    			}
    			return back.on('out', msg);
    		} Gun.on.out = output;

    		function input(msg, cat){ cat = cat || this.as; // TODO: V8 may not be able to optimize functions with different parameter calls, so try to do benchmark to see if there is any actual difference.
    			var root = cat.root, gun = msg.$ || (msg.$ = cat.$), at = (gun||'')._ || empty, tmp = msg.put||'', soul = tmp['#'], key = tmp['.'], change = (u !== tmp['='])? tmp['='] : tmp[':'], state = tmp['>'] || -Infinity, sat; // eve = event, at = data at, cat = chain at, sat = sub at (children chains).
    			if(u !== msg.put && (u === tmp['#'] || u === tmp['.'] || (u === tmp[':'] && u === tmp['=']) || u === tmp['>'])){ // convert from old format
    				if(!valid(tmp)){
    					if(!(soul = ((tmp||'')._||'')['#'])){ console.log("chain not yet supported for", tmp, '...', msg, cat); return; }
    					gun = cat.root.$.get(soul);
    					return setTimeout.each(Object.keys(tmp).sort(), function(k){ // TODO: .keys( is slow // BUG? ?Some re-in logic may depend on this being sync?
    						if('_' == k || u === (state = state_is(tmp, k))){ return }
    						cat.on('in', {$: gun, put: {'#': soul, '.': k, '=': tmp[k], '>': state}, VIA: msg});
    					});
    				}
    				cat.on('in', {$: at.back.$, put: {'#': soul = at.back.soul, '.': key = at.has || at.get, '=': tmp, '>': state_is(at.back.put, key)}, via: msg}); // TODO: This could be buggy! It assumes/approxes data, other stuff could have corrupted it.
    				return;
    			}
    			if((msg.seen||'')[cat.id]){ return } (msg.seen || (msg.seen = function(){}))[cat.id] = cat; // help stop some infinite loops

    			if(cat !== at){ // don't worry about this when first understanding the code, it handles changing contexts on a message. A soul chain will never have a different context.
    				Object.keys(msg).forEach(function(k){ tmp[k] = msg[k]; }, tmp = {}); // make copy of message
    				tmp.get = cat.get || tmp.get;
    				if(!cat.soul && !cat.has){ // if we do not recognize the chain type
    					tmp.$$$ = tmp.$$$ || cat.$; // make a reference to wherever it came from.
    				} else
    				if(at.soul){ // a has (property) chain will have a different context sometimes if it is linked (to a soul chain). Anything that is not a soul or has chain, will always have different contexts.
    					tmp.$ = cat.$;
    					tmp.$$ = tmp.$$ || at.$;
    				}
    				msg = tmp; // use the message with the new context instead;
    			}
    			unlink(msg, cat);

    			if(((cat.soul/* && (cat.ask||'')['']*/) || msg.$$) && state >= state_is(root.graph[soul], key)){ // The root has an in-memory cache of the graph, but if our peer has asked for the data then we want a per deduplicated chain copy of the data that might have local edits on it.
    				(tmp = root.$.get(soul)._).put = state_ify(tmp.put, key, state, change, soul);
    			}
    			if(!at.soul /*&& (at.ask||'')['']*/ && state >= state_is(root.graph[soul], key) && (sat = (root.$.get(soul)._.next||'')[key])){ // Same as above here, but for other types of chains. // TODO: Improve perf by preventing echoes recaching.
    				sat.put = change; // update cache
    				if('string' == typeof (tmp = valid(change))){
    					sat.put = root.$.get(tmp)._.put || change; // share same cache as what we're linked to.
    				}
    			}

    			this.to && this.to.next(msg); // 1st API job is to call all chain listeners.
    			// TODO: Make input more reusable by only doing these (some?) calls if we are a chain we recognize? This means each input listener would be responsible for when listeners need to be called, which makes sense, as they might want to filter.
    			cat.any && setTimeout.each(Object.keys(cat.any), function(any){ (any = cat.any[any]) && any(msg); },0,99); // 1st API job is to call all chain listeners. // TODO: .keys( is slow // BUG: Some re-in logic may depend on this being sync.
    			cat.echo && setTimeout.each(Object.keys(cat.echo), function(lat){ (lat = cat.echo[lat]) && lat.on('in', msg); },0,99); // & linked at chains // TODO: .keys( is slow // BUG: Some re-in logic may depend on this being sync.

    			if(((msg.$$||'')._||at).soul){ // comments are linear, but this line of code is non-linear, so if I were to comment what it does, you'd have to read 42 other comments first... but you can't read any of those comments until you first read this comment. What!? // shouldn't this match link's check?
    				// is there cases where it is a $$ that we do NOT want to do the following? 
    				if((sat = cat.next) && (sat = sat[key])){ // TODO: possible trick? Maybe have `ionmap` code set a sat? // TODO: Maybe we should do `cat.ask` instead? I guess does not matter.
    					tmp = {}; Object.keys(msg).forEach(function(k){ tmp[k] = msg[k]; });
    					tmp.$ = (msg.$$||msg.$).get(tmp.get = key); delete tmp.$$; delete tmp.$$$;
    					sat.on('in', tmp);
    				}
    			}

    			link(msg, cat);
    		} Gun.on.in = input;

    		function link(msg, cat){ cat = cat || this.as || msg.$._;
    			if(msg.$$ && this !== Gun.on){ return } // $$ means we came from a link, so we are at the wrong level, thus ignore it unless overruled manually by being called directly.
    			if(!msg.put || cat.soul){ return } // But you cannot overrule being linked to nothing, or trying to link a soul chain - that must never happen.
    			var put = msg.put||'', link = put['=']||put[':'], tmp;
    			var root = cat.root, tat = root.$.get(put['#']).get(put['.'])._;
    			if('string' != typeof (link = valid(link))){
    				if(this === Gun.on){ (tat.echo || (tat.echo = {}))[cat.id] = cat; } // allow some chain to explicitly force linking to simple data.
    				return; // by default do not link to data that is not a link.
    			}
    			if((tat.echo || (tat.echo = {}))[cat.id] // we've already linked ourselves so we do not need to do it again. Except... (annoying implementation details)
    				&& !(root.pass||'')[cat.id]){ return } // if a new event listener was added, we need to make a pass through for it. The pass will be on the chain, not always the chain passed down. 
    			if(tmp = root.pass){ if(tmp[link+cat.id]){ return } tmp[link+cat.id] = 1; } // But the above edge case may "pass through" on a circular graph causing infinite passes, so we hackily add a temporary check for that.

    			(tat.echo||(tat.echo={}))[cat.id] = cat; // set ourself up for the echo! // TODO: BUG? Echo to self no longer causes problems? Confirm.

    			if(cat.has){ cat.link = link; }
    			var sat = root.$.get(tat.link = link)._; // grab what we're linking to.
    			(sat.echo || (sat.echo = {}))[tat.id] = tat; // link it.
    			var tmp = cat.ask||''; // ask the chain for what needs to be loaded next!
    			if(tmp[''] || cat.lex){ // we might need to load the whole thing // TODO: cat.lex probably has edge case bugs to it, need more test coverage.
    				sat.on('out', {get: {'#': link}});
    			}
    			setTimeout.each(Object.keys(tmp), function(get, sat){ // if sub chains are asking for data. // TODO: .keys( is slow // BUG? ?Some re-in logic may depend on this being sync?
    				if(!get || !(sat = tmp[get])){ return }
    				sat.on('out', {get: {'#': link, '.': get}}); // go get it.
    			},0,99);
    		} Gun.on.link = link;

    		function unlink(msg, cat){ // ugh, so much code for seemingly edge case behavior.
    			var put = msg.put||'', change = (u !== put['='])? put['='] : put[':'], root = cat.root, link, tmp;
    			if(u === change){ // 1st edge case: If we have a brand new database, no data will be found.
    				// TODO: BUG! because emptying cache could be async from below, make sure we are not emptying a newer cache. So maybe pass an Async ID to check against?
    				// TODO: BUG! What if this is a map? // Warning! Clearing things out needs to be robust against sync/async ops, or else you'll see `map val get put` test catastrophically fail because map attempts to link when parent graph is streamed before child value gets set. Need to differentiate between lack acks and force clearing.
    				if(cat.soul && u !== cat.put){ return } // data may not be found on a soul, but if a soul already has data, then nothing can clear the soul as a whole.
    				//if(!cat.has){ return }
    				tmp = (msg.$$||msg.$||'')._||'';
    				if(msg['@'] && (u !== tmp.put || u !== cat.put)){ return } // a "not found" from other peers should not clear out data if we have already found it.
    				//if(cat.has && u === cat.put && !(root.pass||'')[cat.id]){ return } // if we are already unlinked, do not call again, unless edge case. // TODO: BUG! This line should be deleted for "unlink deeply nested".
    				if(link = cat.link || msg.linked){
    					delete (root.$.get(link)._.echo||'')[cat.id];
    				}
    				if(cat.has){ // TODO: Empty out links, maps, echos, acks/asks, etc.?
    					cat.link = null;
    				}
    				cat.put = u; // empty out the cache if, for example, alice's car's color no longer exists (relative to alice) if alice no longer has a car.
    				// TODO: BUG! For maps, proxy this so the individual sub is triggered, not all subs.
    				setTimeout.each(Object.keys(cat.next||''), function(get, sat){ // empty out all sub chains. // TODO: .keys( is slow // BUG? ?Some re-in logic may depend on this being sync? // TODO: BUG? This will trigger deeper put first, does put logic depend on nested order? // TODO: BUG! For map, this needs to be the isolated child, not all of them.
    					if(!(sat = cat.next[get])){ return }
    					//if(cat.has && u === sat.put && !(root.pass||'')[sat.id]){ return } // if we are already unlinked, do not call again, unless edge case. // TODO: BUG! This line should be deleted for "unlink deeply nested".
    					if(link){ delete (root.$.get(link).get(get)._.echo||'')[sat.id]; }
    					sat.on('in', {get: get, put: u, $: sat.$}); // TODO: BUG? Add recursive seen check?
    				},0,99);
    				return;
    			}
    			if(cat.soul){ return } // a soul cannot unlink itself.
    			if(msg.$$){ return } // a linked chain does not do the unlinking, the sub chain does. // TODO: BUG? Will this cancel maps?
    			link = valid(change); // need to unlink anytime we are not the same link, though only do this once per unlink (and not on init).
    			tmp = msg.$._||'';
    			if(link === tmp.link || (cat.has && !tmp.link)){
    				if((root.pass||'')[cat.id] && 'string' !== typeof link); else {
    					return;
    				}
    			}
    			delete (tmp.echo||'')[cat.id];
    			unlink({get: cat.get, put: u, $: msg.$, linked: msg.linked = msg.linked || tmp.link}, cat); // unlink our sub chains.
    		} Gun.on.unlink = unlink;

    		function ack(msg, ev){
    			//if(!msg['%'] && (this||'').off){ this.off() } // do NOT memory leak, turn off listeners! Now handled by .ask itself
    			// manhattan:
    			var as = this.as, at = as.$._; at.root; var get = as.get||'', tmp = (msg.put||'')[get['#']]||'';
    			if(!msg.put || ('string' == typeof get['.'] && u === tmp[get['.']])){
    				if(u !== at.put){ return }
    				if(!at.soul && !at.has){ return } // TODO: BUG? For now, only core-chains will handle not-founds, because bugs creep in if non-core chains are used as $ but we can revisit this later for more powerful extensions.
    				at.ack = (at.ack || 0) + 1;
    				at.on('in', {
    					get: at.get,
    					put: at.put = u,
    					$: at.$,
    					'@': msg['@']
    				});
    				/*(tmp = at.Q) && setTimeout.each(Object.keys(tmp), function(id){ // TODO: Temporary testing, not integrated or being used, probably delete.
    					Object.keys(msg).forEach(function(k){ tmp[k] = msg[k] }, tmp = {}); tmp['@'] = id; // copy message
    					root.on('in', tmp);
    				}); delete at.Q;*/
    				return;
    			}
    			(msg._||{}).miss = 1;
    			Gun.on.put(msg);
    			return; // eom
    		}

    		var empty = {}, u, text_rand = String.random, valid = Gun.valid, obj_has = function(o, k){ return o && Object.prototype.hasOwnProperty.call(o, k) }, state = Gun.state, state_is = state.is, state_ify = state.ify;
    	})(USE, './chain');
    USE(function(module){
    		var Gun = USE('./root');
    		Gun.chain.get = function(key, cb, as){
    			var gun, tmp;
    			if(typeof key === 'string'){
    				if(key.length == 0) {	
    					(gun = this.chain())._.err = {err: Gun.log('0 length key!', key)};
    					if(cb){ cb.call(gun, gun._.err); }
    					return gun;
    				}
    				var back = this, cat = back._;
    				var next = cat.next || empty;
    				if(!(gun = next[key])){
    					gun = key && cache(key, back);
    				}
    				gun = gun && gun.$;
    			} else
    			if('function' == typeof key){
    				if(true === cb){ return soul(this, key, cb, as), this }
    				gun = this;
    				var cat = gun._, opt = cb || {}, root = cat.root, id;
    				opt.at = cat;
    				opt.ok = key;
    				var wait = {}; // can we assign this to the at instead, like in once?
    				//var path = []; cat.$.back(at => { at.get && path.push(at.get.slice(0,9))}); path = path.reverse().join('.');
    				function any(msg, eve, f){
    					if(any.stun){ return }
    					if((tmp = root.pass) && !tmp[id]){ return }
    					var at = msg.$._, sat = (msg.$$||'')._, data = (sat||at).put, odd = (!at.has && !at.soul), test = {}, tmp;
    					if(odd || u === data){ // handles non-core
    						data = (u === ((tmp = msg.put)||'')['='])? (u === (tmp||'')[':'])? tmp : tmp[':'] : tmp['='];
    					}
    					if(('string' == typeof (tmp = Gun.valid(data)))){
    						data = (u === (tmp = root.$.get(tmp)._.put))? opt.not? u : data : tmp;
    					}
    					if(opt.not && u === data){ return }
    					if(u === opt.stun){
    						if((tmp = root.stun) && tmp.on){
    							cat.$.back(function(a){ // our chain stunned?
    								tmp.on(''+a.id, test = {});
    								if((test.run || 0) < any.id){ return test } // if there is an earlier stun on gapless parents/self.
    							});
    							!test.run && tmp.on(''+at.id, test = {}); // this node stunned?
    							!test.run && sat && tmp.on(''+sat.id, test = {}); // linked node stunned?
    							if(any.id > test.run){
    								if(!test.stun || test.stun.end){
    									test.stun = tmp.on('stun');
    									test.stun = test.stun && test.stun.last;
    								}
    								if(test.stun && !test.stun.end){
    									//if(odd && u === data){ return }
    									//if(u === msg.put){ return } // "not found" acks will be found if there is stun, so ignore these.
    									(test.stun.add || (test.stun.add = {}))[id] = function(){ any(msg,eve,1); }; // add ourself to the stun callback list that is called at end of the write.
    									return;
    								}
    							}
    						}
    						if(/*odd &&*/ u === data){ f = 0; } // if data not found, keep waiting/trying.
    						/*if(f && u === data){
    							cat.on('out', opt.out);
    							return;
    						}*/
    						if((tmp = root.hatch) && !tmp.end && u === opt.hatch && !f){ // quick hack! // What's going on here? Because data is streamed, we get things one by one, but a lot of developers would rather get a callback after each batch instead, so this does that by creating a wait list per chain id that is then called at the end of the batch by the hatch code in the root put listener.
    							if(wait[at.$._.id]){ return } wait[at.$._.id] = 1;
    							tmp.push(function(){any(msg,eve,1);});
    							return;
    						} wait = {}; // end quick hack.
    					}
    					// call:
    					if(root.pass){ if(root.pass[id+at.id]){ return } root.pass[id+at.id] = 1; }
    					if(opt.on){ opt.ok.call(at.$, data, at.get, msg, eve || any); return } // TODO: Also consider breaking `this` since a lot of people do `=>` these days and `.call(` has slower performance.
    					if(opt.v2020){ opt.ok(msg, eve || any); return }
    					Object.keys(msg).forEach(function(k){ tmp[k] = msg[k]; }, tmp = {}); msg = tmp; msg.put = data; // 2019 COMPATIBILITY! TODO: GET RID OF THIS!
    					opt.ok.call(opt.as, msg, eve || any); // is this the right
    				}				any.at = cat;
    				//(cat.any||(cat.any=function(msg){ setTimeout.each(Object.keys(cat.any||''), function(act){ (act = cat.any[act]) && act(msg) },0,99) }))[id = String.random(7)] = any; // maybe switch to this in future?
    				(cat.any||(cat.any={}))[id = String.random(7)] = any;
    				any.off = function(){ any.stun = 1; if(!cat.any){ return } delete cat.any[id]; };
    				any.rid = rid; // logic from old version, can we clean it up now?
    				any.id = opt.run || ++root.once; // used in callback to check if we are earlier than a write. // will this ever cause an integer overflow?
    				tmp = root.pass; (root.pass = {})[id] = 1; // Explanation: test trade-offs want to prevent recursion so we add/remove pass flag as it gets fulfilled to not repeat, however map map needs many pass flags - how do we reconcile?
    				opt.out = opt.out || {get: {}};
    				cat.on('out', opt.out);
    				root.pass = tmp;
    				return gun;
    			} else
    			if('number' == typeof key){
    				return this.get(''+key, cb, as);
    			} else
    			if('string' == typeof (tmp = valid(key))){
    				return this.get(tmp, cb, as);
    			} else
    			if(tmp = this.get.next){
    				gun = tmp(this, key);
    			}
    			if(!gun){
    				(gun = this.chain())._.err = {err: Gun.log('Invalid get request!', key)}; // CLEAN UP
    				if(cb){ cb.call(gun, gun._.err); }
    				return gun;
    			}
    			if(cb && 'function' == typeof cb){
    				gun.get(cb, as);
    			}
    			return gun;
    		};
    		function cache(key, back){
    			var cat = back._, next = cat.next, gun = back.chain(), at = gun._;
    			if(!next){ next = cat.next = {}; }
    			next[at.get = key] = at;
    			if(back === cat.root.$){
    				at.soul = key;
    				//at.put = {};
    			} else
    			if(cat.soul || cat.has){
    				at.has = key;
    				//if(obj_has(cat.put, key)){
    					//at.put = cat.put[key];
    				//}
    			}
    			return at;
    		}
    		function soul(gun, cb, opt, as){
    			var cat = gun._, acks = 0, tmp;
    			if(tmp = cat.soul || cat.link){ return cb(tmp, as, cat) }
    			if(cat.jam){ return cat.jam.push([cb, as]) }
    			cat.jam = [[cb,as]];
    			gun.get(function go(msg, eve){
    				if(u === msg.put && !cat.root.opt.super && (tmp = Object.keys(cat.root.opt.peers).length) && ++acks <= tmp){ // TODO: super should not be in core code, bring AXE up into core instead to fix? // TODO: .keys( is slow
    					return;
    				}
    				eve.rid(msg);
    				var at = ((at = msg.$) && at._) || {}, i = 0, as;
    				tmp = cat.jam; delete cat.jam; // tmp = cat.jam.splice(0, 100);
    				//if(tmp.length){ process.nextTick(function(){ go(msg, eve) }) }
    				while(as = tmp[i++]){ //Gun.obj.map(tmp, function(as, cb){
    					var cb = as[0]; as = as[1];
    					cb && cb(at.link || at.soul || Gun.valid(msg.put) || ((msg.put||{})._||{})['#'], as, msg, eve);
    				} //);
    			}, {out: {get: {'.':true}}});
    			return gun;
    		}
    		function rid(at){
    			var cat = this.at || this.on;
    			if(!at || cat.soul || cat.has){ return this.off() }
    			if(!(at = (at = (at = at.$ || at)._ || at).id)){ return }
    			cat.map; var seen;
    			//if(!map || !(tmp = map[at]) || !(tmp = tmp.at)){ return }
    			if((seen = this.seen || (this.seen = {}))[at]){ return true }
    			seen[at] = true;
    			return;
    		}
    		var empty = {}, valid = Gun.valid, u;
    	})(USE, './get');
    USE(function(module){
    		var Gun = USE('./root');
    		Gun.chain.put = function(data, cb, as){ // I rewrote it :)
    			var gun = this, at = gun._, root = at.root;
    			as = as || {};
    			as.root = at.root;
    			as.run || (as.run = root.once);
    			stun(as, at.id); // set a flag for reads to check if this chain is writing.
    			as.ack = as.ack || cb;
    			as.via = as.via || gun;
    			as.data = as.data || data;
    			as.soul || (as.soul = at.soul || ('string' == typeof cb && cb));
    			var s = as.state = as.state || Gun.state();
    			if('function' == typeof data){ data(function(d){ as.data = d; gun.put(u,u,as); }); return gun }
    			if(!as.soul){ return get(as), gun }
    			as.$ = root.$.get(as.soul); // TODO: This may not allow user chaining and similar?
    			as.todo = [{it: as.data, ref: as.$}];
    			as.turn = as.turn || turn;
    			as.ran = as.ran || ran;
    			//var path = []; as.via.back(at => { at.get && path.push(at.get.slice(0,9)) }); path = path.reverse().join('.');
    			// TODO: Perf! We only need to stun chains that are being modified, not necessarily written to.
    			(function walk(){
    				var to = as.todo, at = to.pop(), d = at.it; at.ref && at.ref._.id; var v, k, cat, tmp, g;
    				stun(as, at.ref);
    				if(tmp = at.todo){
    					k = tmp.pop(); d = d[k];
    					if(tmp.length){ to.push(at); }
    				}
    				k && (to.path || (to.path = [])).push(k);
    				if(!(v = valid(d)) && !(g = Gun.is(d))){
    					if(!Object.plain(d)){ ran.err(as, "Invalid data: "+ check(d) +" at " + (as.via.back(function(at){at.get && tmp.push(at.get);}, tmp = []) || tmp.join('.'))+'.'+(to.path||[]).join('.')); return }
    					var seen = as.seen || (as.seen = []), i = seen.length;
    					while(i--){ if(d === (tmp = seen[i]).it){ v = d = tmp.link; break } }
    				}
    				if(k && v){ at.node = state_ify(at.node, k, s, d); } // handle soul later.
    				else {
    					if(!as.seen){ ran.err(as, "Data at root of graph must be a node (an object)."); return }
    					as.seen.push(cat = {it: d, link: {}, todo: g? [] : Object.keys(d).sort().reverse(), path: (to.path||[]).slice(), up: at}); // Any perf reasons to CPU schedule this .keys( ?
    					at.node = state_ify(at.node, k, s, cat.link);
    					!g && cat.todo.length && to.push(cat);
    					// ---------------
    					var id = as.seen.length;
    					(as.wait || (as.wait = {}))[id] = '';
    					tmp = (cat.ref = (g? d : k? at.ref.get(k) : at.ref))._;
    					(tmp = (d && (d._||'')['#']) || tmp.soul || tmp.link)? resolve({soul: tmp}) : cat.ref.get(resolve, {run: as.run, /*hatch: 0,*/ v2020:1, out:{get:{'.':' '}}}); // TODO: BUG! This should be resolve ONLY soul to prevent full data from being loaded. // Fixed now?
    					//setTimeout(function(){ if(F){ return } console.log("I HAVE NOT BEEN CALLED!", path, id, cat.ref._.id, k) }, 9000); var F; // MAKE SURE TO ADD F = 1 below!
    					function resolve(msg, eve){
    						var end = cat.link['#'];
    						if(eve){ eve.off(); eve.rid(msg); } // TODO: Too early! Check all peers ack not found.
    						// TODO: BUG maybe? Make sure this does not pick up a link change wipe, that it uses the changign link instead.
    						var soul = end || msg.soul || (tmp = (msg.$$||msg.$)._||'').soul || tmp.link || ((tmp = tmp.put||'')._||'')['#'] || tmp['#'] || (((tmp = msg.put||'') && msg.$$)? tmp['#'] : (tmp['=']||tmp[':']||'')['#']);
    						!end && stun(as, msg.$);
    						if(!soul && !at.link['#']){ // check soul link above us
    							(at.wait || (at.wait = [])).push(function(){ resolve(msg, eve); }); // wait
    							return;
    						}
    						if(!soul){
    							soul = [];
    							(msg.$$||msg.$).back(function(at){
    								if(tmp = at.soul || at.link){ return soul.push(tmp) }
    								soul.push(at.get);
    							});
    							soul = soul.reverse().join('/');
    						}
    						cat.link['#'] = soul;
    						!g && (((as.graph || (as.graph = {}))[soul] = (cat.node || (cat.node = {_:{}})))._['#'] = soul);
    						delete as.wait[id];
    						cat.wait && setTimeout.each(cat.wait, function(cb){ cb && cb(); });
    						as.ran(as);
    					}					// ---------------
    				}
    				if(!to.length){ return as.ran(as) }
    				as.turn(walk);
    			}());
    			return gun;
    		};

    		function stun(as, id){
    			if(!id){ return } id = (id._||'').id||id;
    			var run = as.root.stun || (as.root.stun = {on: Gun.on}), test = {}, tmp;
    			as.stun || (as.stun = run.on('stun', function(){ }));
    			if(tmp = run.on(''+id)){ tmp.the.last.next(test); }
    			if(test.run >= as.run){ return }
    			run.on(''+id, function(test){
    				if(as.stun.end){
    					this.off();
    					this.to.next(test);
    					return;
    				}
    				test.run = test.run || as.run;
    				test.stun = test.stun || as.stun; return;
    			});
    		}

    		function ran(as){
    			if(as.err){ ran.end(as.stun, as.root); return } // move log handle here.
    			if(as.todo.length || as.end || !Object.empty(as.wait)){ return } as.end = 1;
    			//(as.retry = function(){ as.acks = 0;
    			var cat = (as.$.back(-1)._), root = cat.root, ask = cat.ask(function(ack){
    				root.on('ack', ack);
    				if(ack.err && !ack.lack){ Gun.log(ack); }
    				if(++acks > (as.acks || 0)){ this.off(); } // Adjustable ACKs! Only 1 by default.
    				if(!as.ack){ return }
    				as.ack(ack, this);
    			}, as.opt), acks = 0, stun = as.stun, tmp;
    			(tmp = function(){ // this is not official yet, but quick solution to hack in for now.
    				if(!stun){ return }
    				ran.end(stun, root);
    				setTimeout.each(Object.keys(stun = stun.add||''), function(cb){ if(cb = stun[cb]){cb();} }); // resume the stunned reads // Any perf reasons to CPU schedule this .keys( ?
    			}).hatch = tmp; // this is not official yet ^
    			//console.log(1, "PUT", as.run, as.graph);
    			if(as.ack && !as.ok){ as.ok = as.acks || 9; } // TODO: In future! Remove this! This is just old API support.
    			(as.via._).on('out', {put: as.out = as.graph, ok: as.ok && {'@': as.ok+1}, opt: as.opt, '#': ask, _: tmp});
    			//})();
    		} ran.end = function(stun,root){
    			stun.end = noop; // like with the earlier id, cheaper to make this flag a function so below callbacks do not have to do an extra type check.
    			if(stun.the.to === stun && stun === stun.the.last){ delete root.stun; }
    			stun.off();
    		}; ran.err = function(as, err){
    			(as.ack||noop).call(as, as.out = { err: as.err = Gun.log(err) });
    			as.ran(as);
    		};

    		function get(as){
    			var at = as.via._, tmp;
    			as.via = as.via.back(function(at){
    				if(at.soul || !at.get){ return at.$ }
    				tmp = as.data; (as.data = {})[at.get] = tmp;
    			});
    			if(!as.via || !as.via._.soul){
    				as.via = at.root.$.get(((as.data||'')._||'')['#'] || at.$.back('opt.uuid')());
    			}
    			as.via.put(as.data, as.ack, as);
    			

    			return;
    		}
    		function check(d, tmp){ return ((d && (tmp = d.constructor) && tmp.name) || typeof d) }

    		var u, noop = function(){}, turn = setTimeout.turn, valid = Gun.valid, state_ify = Gun.state.ify;
    	})(USE, './put');
    USE(function(module){
    		var Gun = USE('./root');
    		USE('./chain');
    		USE('./back');
    		USE('./put');
    		USE('./get');
    		module.exports = Gun;
    	})(USE, './index');
    USE(function(module){
    		var Gun = USE('./index');
    		Gun.chain.on = function(tag, arg, eas, as){ // don't rewrite!
    			var gun = this, cat = gun._; cat.root; var act;
    			if(typeof tag === 'string'){
    				if(!arg){ return cat.on(tag) }
    				act = cat.on(tag, arg, eas || cat, as);
    				if(eas && eas.$){
    					(eas.subs || (eas.subs = [])).push(act);
    				}
    				return gun;
    			}
    			var opt = arg;
    			(opt = (true === opt)? {change: true} : opt || {}).not = 1; opt.on = 1;
    			gun.get(tag, opt);
    			/*gun.get(function on(data,key,msg,eve){ var $ = this;
    				if(tmp = root.hatch){ // quick hack!
    					if(wait[$._.id]){ return } wait[$._.id] = 1;
    					tmp.push(function(){on.call($, data,key,msg,eve)});
    					return;
    				}; wait = {}; // end quick hack.
    				tag.call($, data,key,msg,eve);
    			}, opt); // TODO: PERF! Event listener leak!!!?*/
    			/*
    			function one(msg, eve){
    				if(one.stun){ return }
    				var at = msg.$._, data = at.put, tmp;
    				if(tmp = at.link){ data = root.$.get(tmp)._.put }
    				if(opt.not===u && u === data){ return }
    				if(opt.stun===u && (tmp = root.stun) && (tmp = tmp[at.id] || tmp[at.back.id]) && !tmp.end){ // Remember! If you port this into `.get(cb` make sure you allow stun:0 skip option for `.put(`.
    					tmp[id] = function(){one(msg,eve)};
    					return;
    				}
    				//tmp = one.wait || (one.wait = {}); console.log(tmp[at.id] === ''); if(tmp[at.id] !== ''){ tmp[at.id] = tmp[at.id] || setTimeout(function(){tmp[at.id]='';one(msg,eve)},1); return } delete tmp[at.id];
    				// call:
    				if(opt.as){
    					opt.ok.call(opt.as, msg, eve || one);
    				} else {
    					opt.ok.call(at.$, data, msg.get || at.get, msg, eve || one);
    				}
    			};
    			one.at = cat;
    			(cat.act||(cat.act={}))[id = String.random(7)] = one;
    			one.off = function(){ one.stun = 1; if(!cat.act){ return } delete cat.act[id] }
    			cat.on('out', {get: {}});*/
    			return gun;
    		};
    		// Rules:
    		// 1. If cached, should be fast, but not read while write.
    		// 2. Should not retrigger other listeners, should get triggered even if nothing found.
    		// 3. If the same callback passed to many different once chains, each should resolve - an unsubscribe from the same callback should not effect the state of the other resolving chains, if you do want to cancel them all early you should mutate the callback itself with a flag & check for it at top of callback
    		Gun.chain.once = function(cb, opt){ opt = opt || {}; // avoid rewriting
    			if(!cb){ return none(this) }
    			var gun = this, cat = gun._, root = cat.root; cat.put; var id = String.random(7), tmp;
    			gun.get(function(data,key,msg,eve){
    				var $ = this, at = $._, one = (at.one||(at.one={}));
    				if(eve.stun){ return } if('' === one[id]){ return }
    				if(true === (tmp = Gun.valid(data))){ once(); return }
    				if('string' == typeof tmp){ return } // TODO: BUG? Will this always load?
    				clearTimeout((cat.one||'')[id]); // clear "not found" since they only get set on cat.
    				clearTimeout(one[id]); one[id] = setTimeout(once, opt.wait||99); // TODO: Bug? This doesn't handle plural chains.
    				function once(f){
    					if(!at.has && !at.soul){ at = {put: data, get: key}; } // handles non-core messages.
    					if(u === (tmp = at.put)){ tmp = ((msg.$$||'')._||'').put; }
    					if('string' == typeof Gun.valid(tmp)){
    						tmp = root.$.get(tmp)._.put;
    						if(tmp === u && !f){
    							one[id] = setTimeout(function(){ once(1); }, opt.wait||99); // TODO: Quick fix. Maybe use ack count for more predictable control?
    							return
    						}
    					}
    					//console.log("AND VANISHED", data);
    					if(eve.stun){ return } if('' === one[id]){ return } one[id] = '';
    					if(cat.soul || cat.has){ eve.off(); } // TODO: Plural chains? // else { ?.off() } // better than one check?
    					cb.call($, tmp, at.get);
    					clearTimeout(one[id]); // clear "not found" since they only get set on cat. // TODO: This was hackily added, is it necessary or important? Probably not, in future try removing this. Was added just as a safety for the `&& !f` check.
    				}			}, {on: 1});
    			return gun;
    		};
    		function none(gun,opt,chain){
    			Gun.log.once("valonce", "Chainable val is experimental, its behavior and API may change moving forward. Please play with it and report bugs and ideas on how to improve it.");
    			(chain = gun.chain())._.nix = gun.once(function(data, key){ chain._.on('in', this._); });
    			chain._.lex = gun._.lex; // TODO: Better approach in future? This is quick for now.
    			return chain;
    		}

    		Gun.chain.off = function(){
    			// make off more aggressive. Warning, it might backfire!
    			var gun = this, at = gun._, tmp;
    			var cat = at.back;
    			if(!cat){ return }
    			at.ack = 0; // so can resubscribe.
    			if(tmp = cat.next){
    				if(tmp[at.get]){
    					delete tmp[at.get];
    				}
    			}
    			// TODO: delete cat.one[map.id]?
    			if (tmp = cat.any) {
    				delete cat.any;
    				cat.any = {};
    			}
    			if(tmp = cat.ask){
    				delete tmp[at.get];
    			}
    			if(tmp = cat.put){
    				delete tmp[at.get];
    			}
    			if(tmp = at.soul){
    				delete cat.root.graph[tmp];
    			}
    			if(tmp = at.map){
    				Object.keys(tmp).forEach(function(i,at){ at = tmp[i]; //obj_map(tmp, function(at){
    					if(at.link){
    						cat.root.$.get(at.link).off();
    					}
    				});
    			}
    			if(tmp = at.next){
    				Object.keys(tmp).forEach(function(i,neat){ neat = tmp[i]; //obj_map(tmp, function(neat){
    					neat.$.off();
    				});
    			}
    			at.on('off', {});
    			return gun;
    		};
    		var u;
    	})(USE, './on');
    USE(function(module){
    		var Gun = USE('./index'), next = Gun.chain.get.next;
    		Gun.chain.get.next = function(gun, lex){ var tmp;
    			if(!Object.plain(lex)){ return (next||noop)(gun, lex) }
    			if(tmp = ((tmp = lex['#'])||'')['='] || tmp){ return gun.get(tmp) }
    			(tmp = gun.chain()._).lex = lex; // LEX!
    			gun.on('in', function(eve){
    				if(String.match(eve.get|| (eve.put||'')['.'], lex['.'] || lex['#'] || lex)){
    					tmp.on('in', eve);
    				}
    				this.to.next(eve);
    			});
    			return tmp.$;
    		};
    		Gun.chain.map = function(cb, opt, t){
    			var gun = this, cat = gun._, lex, chain;
    			if(Object.plain(cb)){ lex = cb['.']? cb : {'.': cb}; cb = u; }
    			if(!cb){
    				if(chain = cat.each){ return chain }
    				(cat.each = chain = gun.chain())._.lex = lex || chain._.lex || cat.lex;
    				chain._.nix = gun.back('nix');
    				gun.on('in', map, chain._);
    				return chain;
    			}
    			Gun.log.once("mapfn", "Map functions are experimental, their behavior and API may change moving forward. Please play with it and report bugs and ideas on how to improve it.");
    			chain = gun.chain();
    			gun.map().on(function(data, key, msg, eve){
    				var next = (cb||noop).call(this, data, key, msg, eve);
    				if(u === next){ return }
    				if(data === next){ return chain._.on('in', msg) }
    				if(Gun.is(next)){ return chain._.on('in', next._) }
    				var tmp = {}; Object.keys(msg.put).forEach(function(k){ tmp[k] = msg.put[k]; }, tmp); tmp['='] = next; 
    				chain._.on('in', {get: key, put: tmp});
    			});
    			return chain;
    		};
    		function map(msg){ this.to.next(msg);
    			var cat = this.as, gun = msg.$, at = gun._, put = msg.put, tmp;
    			if(!at.soul && !msg.$$){ return } // this line took hundreds of tries to figure out. It only works if core checks to filter out above chains during link tho. This says "only bother to map on a node" for this layer of the chain. If something is not a node, map should not work.
    			if((tmp = cat.lex) && !String.match(msg.get|| (put||'')['.'], tmp['.'] || tmp['#'] || tmp)){ return }
    			Gun.on.link(msg, cat);
    		}
    		var noop = function(){}, u;
    	})(USE, './map');
    USE(function(module){
    		var Gun = USE('./index');
    		Gun.chain.set = function(item, cb, opt){
    			var gun = this, root = gun.back(-1), soul, tmp;
    			cb = cb || function(){};
    			opt = opt || {}; opt.item = opt.item || item;
    			if(soul = ((item||'')._||'')['#']){ (item = {})['#'] = soul; } // check if node, make link.
    			if('string' == typeof (tmp = Gun.valid(item))){ return gun.get(soul = tmp).put(item, cb, opt) } // check if link
    			if(!Gun.is(item)){
    				if(Object.plain(item)){
    					item = root.get(soul = gun.back('opt.uuid')()).put(item);
    				}
    				return gun.get(soul || root.back('opt.uuid')(7)).put(item, cb, opt);
    			}
    			gun.put(function(go){
    				item.get(function(soul, o, msg){ // TODO: BUG! We no longer have this option? & go error not handled?
    					if(!soul){ return cb.call(gun, {err: Gun.log('Only a node can be linked! Not "' + msg.put + '"!')}) }
    					(tmp = {})[soul] = {'#': soul}; go(tmp);
    				},true);
    			});
    			return item;
    		};
    	})(USE, './set');
    USE(function(module){
    		USE('./shim');

    		var noop = function(){};
    		var parse = JSON.parseAsync || function(t,cb,r){ var u, d = +new Date; try{ cb(u, JSON.parse(t,r), json.sucks(+new Date - d)); }catch(e){ cb(e); } };
    		var json = JSON.stringifyAsync || function(v,cb,r,s){ var u, d = +new Date; try{ cb(u, JSON.stringify(v,r,s), json.sucks(+new Date - d)); }catch(e){ cb(e); } };
    		json.sucks = function(d){ if(d > 99){ console.log("Warning: JSON blocking CPU detected. Add `gun/lib/yson.js` to fix."); json.sucks = noop; } };

    		function Mesh(root){
    			var mesh = function(){};
    			var opt = root.opt || {};
    			opt.log = opt.log || console.log;
    			opt.gap = opt.gap || opt.wait || 0;
    			opt.max = opt.max || (opt.memory? (opt.memory * 999 * 999) : 300000000) * 0.3;
    			opt.pack = opt.pack || (opt.max * 0.01 * 0.01);
    			opt.puff = opt.puff || 9; // IDEA: do a start/end benchmark, divide ops/result.
    			var puff = setTimeout.turn || setTimeout;

    			var dup = root.dup, dup_check = dup.check, dup_track = dup.track;

    			var hear = mesh.hear = function(raw, peer){
    				if(!raw){ return }
    				if(opt.max <= raw.length){ return mesh.say({dam: '!', err: "Message too big!"}, peer) }
    				if(mesh === this){
    					/*if('string' == typeof raw){ try{
    						var stat = console.STAT || {};
    						//console.log('HEAR:', peer.id, (raw||'').slice(0,250), ((raw||'').length / 1024 / 1024).toFixed(4));
    						
    						//console.log(setTimeout.turn.s.length, 'stacks', parseFloat((-(LT - (LT = +new Date))/1000).toFixed(3)), 'sec', parseFloat(((LT-ST)/1000 / 60).toFixed(1)), 'up', stat.peers||0, 'peers', stat.has||0, 'has', stat.memhused||0, stat.memused||0, stat.memax||0, 'heap mem max');
    					}catch(e){ console.log('DBG err', e) }}*/
    					hear.d += raw.length||0 ; ++hear.c; } // STATS!
    				var S = peer.SH = +new Date;
    				var tmp = raw[0], msg;
    				//raw && raw.slice && console.log("hear:", ((peer.wire||'').headers||'').origin, raw.length, raw.slice && raw.slice(0,50)); //tc-iamunique-tc-package-ds1
    				if('[' === tmp){
    					parse(raw, function(err, msg){
    						if(err || !msg){ return mesh.say({dam: '!', err: "DAM JSON parse error."}, peer) }
    						console.STAT && console.STAT(+new Date, msg.length, '# on hear batch');
    						var P = opt.puff;
    						(function go(){
    							var S = +new Date;
    							var i = 0, m; while(i < P && (m = msg[i++])){ mesh.hear(m, peer); }
    							msg = msg.slice(i); // slicing after is faster than shifting during.
    							console.STAT && console.STAT(S, +new Date - S, 'hear loop');
    							flush(peer); // force send all synchronously batched acks.
    							if(!msg.length){ return }
    							puff(go, 0);
    						}());
    					});
    					raw = ''; // 
    					return;
    				}
    				if('{' === tmp || ((raw['#'] || Object.plain(raw)) && (msg = raw))){
    					if(msg){ return hear.one(msg, peer, S) }
    					parse(raw, function(err, msg){
    						if(err || !msg){ return mesh.say({dam: '!', err: "DAM JSON parse error."}, peer) }
    						hear.one(msg, peer, S);
    					});
    					return;
    				}
    			};
    			hear.one = function(msg, peer, S){ // S here is temporary! Undo.
    				var id, hash, tmp, ash, DBG;
    				if(msg.DBG){ msg.DBG = DBG = {DBG: msg.DBG}; }
    				DBG && (DBG.h = S);
    				DBG && (DBG.hp = +new Date);
    				if(!(id = msg['#'])){ id = msg['#'] = String.random(9); }
    				if(tmp = dup_check(id)){ return }
    				// DAM logic:
    				if(!(hash = msg['##']) && false && u !== msg.put); // disable hashing for now // TODO: impose warning/penalty instead (?)
    				if(hash && (tmp = msg['@'] || (msg.get && id)) && dup.check(ash = tmp+hash)){ return } // Imagine A <-> B <=> (C & D), C & D reply with same ACK but have different IDs, B can use hash to dedup. Or if a GET has a hash already, we shouldn't ACK if same.
    				(msg._ = function(){}).via = mesh.leap = peer;
    				if((tmp = msg['><']) && 'string' == typeof tmp){ tmp.slice(0,99).split(',').forEach(function(k){ this[k] = 1; }, (msg._).yo = {}); } // Peers already sent to, do not resend.
    				// DAM ^
    				if(tmp = msg.dam){
    					if(tmp = mesh.hear[tmp]){
    						tmp(msg, peer, root);
    					}
    					dup_track(id);
    					return;
    				}
    				if(tmp = msg.ok){ msg._.near = tmp['/']; }
    				var S = +new Date;
    				DBG && (DBG.is = S); peer.SI = id;
    				dup_track.ed = function(d){
    					if(id !== d){ return }
    					dup_track.ed = 0;
    					if(!(d = dup.s[id])){ return }
    					d.via = peer;
    					if(msg.get){ d.it = msg; }
    				};
    				root.on('in', mesh.last = msg);
    				DBG && (DBG.hd = +new Date);
    				console.STAT && console.STAT(S, +new Date - S, msg.get? 'msg get' : msg.put? 'msg put' : 'msg');
    				dup_track(id); // in case 'in' does not call track.
    				if(ash){ dup_track(ash); } //dup.track(tmp+hash, true).it = it(msg);
    				mesh.leap = mesh.last = null; // warning! mesh.leap could be buggy.
    			};
    			hear.c = hear.d = 0;
    (function(){
    				var SMIA = 0;
    				var loop;
    				mesh.hash = function(msg, peer){ var h, s, t;
    					var S = +new Date;
    					json(msg.put, function hash(err, text){
    						var ss = (s || (s = t = text||'')).slice(0, 32768); // 1024 * 32
    					  h = String.hash(ss, h); s = s.slice(32768);
    					  if(s){ puff(hash, 0); return }
    						console.STAT && console.STAT(S, +new Date - S, 'say json+hash');
    					  msg._.$put = t;
    					  msg['##'] = h;
    					  mesh.say(msg, peer);
    					  delete msg._.$put;
    					}, sort);
    				};
    				function sort(k, v){ var tmp;
    					if(!(v instanceof Object)){ return v }
    					Object.keys(v).sort().forEach(sorta, {to: tmp = {}, on: v});
    					return tmp;
    				} function sorta(k){ this.to[k] = this.on[k]; }

    				mesh.say = function(msg, peer){ var tmp;
    					if((tmp = this) && (tmp = tmp.to) && tmp.next){ tmp.next(msg); } // compatible with middleware adapters.
    					if(!msg){ return false }
    					var id, hash, raw, ack = msg['@'];
    //if(opt.super && (!ack || !msg.put)){ return } // TODO: MANHATTAN STUB //OBVIOUSLY BUG! But squelch relay. // :( get only is 100%+ CPU usage :(
    					var meta = msg._||(msg._=function(){});
    					var DBG = msg.DBG, S = +new Date; meta.y = meta.y || S; if(!peer){ DBG && (DBG.y = S); }
    					if(!(id = msg['#'])){ id = msg['#'] = String.random(9); }
    					!loop && dup_track(id);//.it = it(msg); // track for 9 seconds, default. Earth<->Mars would need more! // always track, maybe move this to the 'after' logic if we split function.
    					//if(msg.put && (msg.err || (dup.s[id]||'').err)){ return false } // TODO: in theory we should not be able to stun a message, but for now going to check if it can help network performance preventing invalid data to relay.
    					if(!(hash = msg['##']) && u !== msg.put && !meta.via && ack){ mesh.hash(msg, peer); return } // TODO: Should broadcasts be hashed?
    					if(!peer && ack){ peer = ((tmp = dup.s[ack]) && (tmp.via || ((tmp = tmp.it) && (tmp = tmp._) && tmp.via))) || ((tmp = mesh.last) && ack === tmp['#'] && mesh.leap); } // warning! mesh.leap could be buggy! mesh last check reduces this. // TODO: CLEAN UP THIS LINE NOW? `.it` should be reliable.
    					if(!peer && ack){ // still no peer, then ack daisy chain 'tunnel' got lost.
    						if(dup.s[ack]){ return } // in dups but no peer hints that this was ack to ourself, ignore.
    						console.STAT && console.STAT(+new Date, ++SMIA, 'total no peer to ack to'); // TODO: Delete this now. Dropping lost ACKs is protocol fine now.
    						return false;
    					} // TODO: Temporary? If ack via trace has been lost, acks will go to all peers, which trashes browser bandwidth. Not relaying the ack will force sender to ask for ack again. Note, this is technically wrong for mesh behavior.
    					if(ack && !msg.put && !hash && ((dup.s[ack]||'').it||'')['##']){ return false } // If we're saying 'not found' but a relay had data, do not bother sending our not found. // Is this correct, return false? // NOTE: ADD PANIC TEST FOR THIS!
    					if(!peer && mesh.way){ return mesh.way(msg) }
    					DBG && (DBG.yh = +new Date);
    					if(!(raw = meta.raw)){ mesh.raw(msg, peer); return }
    					DBG && (DBG.yr = +new Date);
    					if(!peer || !peer.id){
    						if(!Object.plain(peer || opt.peers)){ return false }
    						var S = +new Date;
    						opt.puff; var ps = opt.peers, pl = Object.keys(peer || opt.peers || {}); // TODO: .keys( is slow
    						console.STAT && console.STAT(S, +new Date - S, 'peer keys');
    (function go(){
    							var S = +new Date;
    							//Type.obj.map(peer || opt.peers, each); // in case peer is a peer list.
    							loop = 1; var wr = meta.raw; meta.raw = raw; // quick perf hack
    							var i = 0, p; while(i < 9 && (p = (pl||'')[i++])){
    								if(!(p = ps[p] || (peer||'')[p])){ continue }
    								mesh.say(msg, p);
    							}
    							meta.raw = wr; loop = 0;
    							pl = pl.slice(i); // slicing after is faster than shifting during.
    							console.STAT && console.STAT(S, +new Date - S, 'say loop');
    							if(!pl.length){ return }
    							puff(go, 0);
    							ack && dup_track(ack); // keep for later
    						}());
    						return;
    					}
    					// TODO: PERF: consider splitting function here, so say loops do less work.
    					if(!peer.wire && mesh.wire){ mesh.wire(peer); }
    					if(id === peer.last){ return } peer.last = id;  // was it just sent?
    					if(peer === meta.via){ return false } // don't send back to self.
    					if((tmp = meta.yo) && (tmp[peer.url] || tmp[peer.pid] || tmp[peer.id]) /*&& !o*/){ return false }
    					console.STAT && console.STAT(S, ((DBG||meta).yp = +new Date) - (meta.y || S), 'say prep');
    					!loop && ack && dup_track(ack); // streaming long responses needs to keep alive the ack.
    					if(peer.batch){
    						peer.tail = (tmp = peer.tail || 0) + raw.length;
    						if(peer.tail <= opt.pack){
    							peer.batch += (tmp?',':'')+raw;
    							return;
    						}
    						flush(peer);
    					}
    					peer.batch = '['; // Prevents double JSON!
    					var ST = +new Date;
    					setTimeout(function(){
    						console.STAT && console.STAT(ST, +new Date - ST, '0ms TO');
    						flush(peer);
    					}, opt.gap); // TODO: queuing/batching might be bad for low-latency video game performance! Allow opt out?
    					send(raw, peer);
    					console.STAT && (ack === peer.SI) && console.STAT(S, +new Date - peer.SH, 'say ack');
    				};
    				mesh.say.c = mesh.say.d = 0;
    				// TODO: this caused a out-of-memory crash!
    				mesh.raw = function(msg, peer){ // TODO: Clean this up / delete it / move logic out!
    					if(!msg){ return '' }
    					var meta = (msg._) || {}, put, tmp;
    					if(tmp = meta.raw){ return tmp }
    					if('string' == typeof msg){ return msg }
    					var hash = msg['##'], ack = msg['@'];
    					if(hash && ack){
    						if(!meta.via && dup_check(ack+hash)){ return false } // for our own out messages, memory & storage may ack the same thing, so dedup that. Tho if via another peer, we already tracked it upon hearing, so this will always trigger false positives, so don't do that!
    						if(tmp = (dup.s[ack]||'').it){
    							if(hash === tmp['##']){ return false } // if ask has a matching hash, acking is optional.
    							if(!tmp['##']){ tmp['##'] = hash; } // if none, add our hash to ask so anyone we relay to can dedup. // NOTE: May only check against 1st ack chunk, 2nd+ won't know and still stream back to relaying peers which may then dedup. Any way to fix this wasted bandwidth? I guess force rate limiting breaking change, that asking peer has to ask for next lexical chunk.
    						}
    					}
    					if(!msg.dam && !msg['@']){
    						var i = 0, to = []; tmp = opt.peers;
    						for(var k in tmp){ var p = tmp[k]; // TODO: Make it up peers instead!
    							to.push(p.url || p.pid || p.id);
    							if(++i > 6){ break }
    						}
    						if(i > 1){ msg['><'] = to.join(); } // TODO: BUG! This gets set regardless of peers sent to! Detect?
    					}
    					if(msg.put && (tmp = msg.ok)){ msg.ok = {'@':(tmp['@']||1)-1, '/': (tmp['/']==msg._.near)? mesh.near : tmp['/']}; }
    					if(put = meta.$put){
    						tmp = {}; Object.keys(msg).forEach(function(k){ tmp[k] = msg[k]; });
    						tmp.put = ':])([:';
    						json(tmp, function(err, raw){
    							if(err){ return } // TODO: Handle!!
    							var S = +new Date;
    							tmp = raw.indexOf('"put":":])([:"');
    							res(u, raw = raw.slice(0, tmp+6) + put + raw.slice(tmp + 14));
    							console.STAT && console.STAT(S, +new Date - S, 'say slice');
    						});
    						return;
    					}
    					json(msg, res);
    					function res(err, raw){
    						if(err){ return } // TODO: Handle!!
    						meta.raw = raw; //if(meta && (raw||'').length < (999 * 99)){ meta.raw = raw } // HNPERF: If string too big, don't keep in memory.
    						mesh.say(msg, peer);
    					}
    				};
    			}());

    			function flush(peer){
    				var tmp = peer.batch, t = 'string' == typeof tmp;
    				if(t){ tmp += ']'; }// TODO: Prevent double JSON!
    				peer.batch = peer.tail = null;
    				if(!tmp){ return }
    				if(t? 3 > tmp.length : !tmp.length){ return } // TODO: ^
    				if(!t){try{tmp = (1 === tmp.length? tmp[0] : JSON.stringify(tmp));
    				}catch(e){return opt.log('DAM JSON stringify error', e)}}
    				if(!tmp){ return }
    				send(tmp, peer);
    			}
    			// for now - find better place later.
    			function send(raw, peer){ try{
    				var wire = peer.wire;
    				if(peer.say){
    					peer.say(raw);
    				} else
    				if(wire.send){
    					wire.send(raw);
    				}
    				mesh.say.d += raw.length||0; ++mesh.say.c; // STATS!
    			}catch(e){
    				(peer.queue = peer.queue || []).push(raw);
    			}}

    			mesh.near = 0;
    			mesh.hi = function(peer){
    				var wire = peer.wire, tmp;
    				if(!wire){ mesh.wire((peer.length && {url: peer, id: peer}) || peer); return }
    				if(peer.id){
    					opt.peers[peer.url || peer.id] = peer;
    				} else {
    					tmp = peer.id = peer.id || peer.url || String.random(9);
    					mesh.say({dam: '?', pid: root.opt.pid}, opt.peers[tmp] = peer);
    					delete dup.s[peer.last]; // IMPORTANT: see https://gun.eco/docs/DAM#self
    				}
    				if(!peer.met){
    					mesh.near++;
    					peer.met = +(new Date);
    					root.on('hi', peer);
    				}
    				// @rogowski I need this here by default for now to fix go1dfish's bug
    				tmp = peer.queue; peer.queue = [];
    				setTimeout.each(tmp||[],function(msg){
    					send(msg, peer);
    				},0,9);
    				//Type.obj.native && Type.obj.native(); // dirty place to check if other JS polluted.
    			};
    			mesh.bye = function(peer){
    				peer.met && --mesh.near;
    				delete peer.met;
    				root.on('bye', peer);
    				var tmp = +(new Date); tmp = (tmp - (peer.met||tmp));
    				mesh.bye.time = ((mesh.bye.time || tmp) + tmp) / 2;
    			};
    			mesh.hear['!'] = function(msg, peer){ opt.log('Error:', msg.err); };
    			mesh.hear['?'] = function(msg, peer){
    				if(msg.pid){
    					if(!peer.pid){ peer.pid = msg.pid; }
    					if(msg['@']){ return }
    				}
    				mesh.say({dam: '?', pid: opt.pid, '@': msg['#']}, peer);
    				delete dup.s[peer.last]; // IMPORTANT: see https://gun.eco/docs/DAM#self
    			};
    			mesh.hear['mob'] = function(msg, peer){ // NOTE: AXE will overload this with better logic.
    				if(!msg.peers){ return }
    				var peers = Object.keys(msg.peers), one = peers[(Math.random()*peers.length) >> 0];
    				if(!one){ return }
    				mesh.bye(peer);
    				mesh.hi(one);
    			};

    			root.on('create', function(root){
    				root.opt.pid = root.opt.pid || String.random(9);
    				this.to.next(root);
    				root.on('out', mesh.say);
    			});

    			root.on('bye', function(peer, tmp){
    				peer = opt.peers[peer.id || peer] || peer;
    				this.to.next(peer);
    				peer.bye? peer.bye() : (tmp = peer.wire) && tmp.close && tmp.close();
    				delete opt.peers[peer.id];
    				peer.wire = null;
    			});

    			var gets = {};
    			root.on('bye', function(peer, tmp){ this.to.next(peer);
    				if(tmp = console.STAT){ tmp.peers = mesh.near; }
    				if(!(tmp = peer.url)){ return } gets[tmp] = true;
    				setTimeout(function(){ delete gets[tmp]; },opt.lack || 9000);
    			});
    			root.on('hi', function(peer, tmp){ this.to.next(peer);
    				if(tmp = console.STAT){ tmp.peers = mesh.near; }
    				if(opt.super){ return } // temporary (?) until we have better fix/solution?
    				var souls = Object.keys(root.next||''); // TODO: .keys( is slow
    				if(souls.length > 9999 && !console.SUBS){ console.log(console.SUBS = "Warning: You have more than 10K live GETs, which might use more bandwidth than your screen can show - consider `.off()`."); }
    				setTimeout.each(souls, function(soul){ var node = root.next[soul];
    					if(opt.super || (node.ask||'')['']){ mesh.say({get: {'#': soul}}, peer); return }
    					setTimeout.each(Object.keys(node.ask||''), function(key){ if(!key){ return }
    						// is the lack of ## a !onion hint?
    						mesh.say({'##': String.hash((root.graph[soul]||'')[key]), get: {'#': soul, '.': key}}, peer);
    						// TODO: Switch this so Book could route?
    					});
    				});
    			});

    			return mesh;
    		}
    	  var u;

    	  try{ module.exports = Mesh; }catch(e){}

    	})(USE, './mesh');
    USE(function(module){
    		var Gun = USE('./index');
    		Gun.Mesh = USE('./mesh');

    		// TODO: resync upon reconnect online/offline
    		//window.ononline = window.onoffline = function(){ console.log('online?', navigator.onLine) }

    		Gun.on('opt', function(root){
    			this.to.next(root);
    			if(root.once){ return }
    			var opt = root.opt;
    			if(false === opt.WebSocket){ return }

    			var env = Gun.window || {};
    			var websocket = opt.WebSocket || env.WebSocket || env.webkitWebSocket || env.mozWebSocket;
    			if(!websocket){ return }
    			opt.WebSocket = websocket;

    			var mesh = opt.mesh = opt.mesh || Gun.Mesh(root);

    			mesh.wire || opt.wire;
    			mesh.wire = opt.wire = open;
    			function open(peer){ try{
    				if(!peer || !peer.url){ return wire && wire(peer) }
    				var url = peer.url.replace(/^http/, 'ws');
    				var wire = peer.wire = new opt.WebSocket(url);
    				wire.onclose = function(){
    					reconnect(peer);
    					opt.mesh.bye(peer);
    				};
    				wire.onerror = function(err){
    					reconnect(peer);
    				};
    				wire.onopen = function(){
    					opt.mesh.hi(peer);
    				};
    				wire.onmessage = function(msg){
    					if(!msg){ return }
    					opt.mesh.hear(msg.data || msg, peer);
    				};
    				return wire;
    			}catch(e){ opt.mesh.bye(peer); }}

    			setTimeout(function(){ !opt.super && root.on('out', {dam:'hi'}); },1); // it can take a while to open a socket, so maybe no longer lazy load for perf reasons?

    			var wait = 2 * 999;
    			function reconnect(peer){
    				clearTimeout(peer.defer);
    				if(!opt.peers[peer.url]){ return }
    				if(doc && peer.retry <= 0){ return }
    				peer.retry = (peer.retry || opt.retry+1 || 60) - ((-peer.tried + (peer.tried = +new Date) < wait*4)?1:0);
    				peer.defer = setTimeout(function to(){
    					if(doc && doc.hidden){ return setTimeout(to,wait) }
    					open(peer);
    				}, wait);
    			}
    			var doc = (''+u !== typeof document) && document;
    		});
    		var u;
    	})(USE, './websocket');
    USE(function(module){
    		if(typeof Gun === 'undefined'){ return }

    		var noop = function(){}, store;
    		try{store = (Gun.window||noop).localStorage;}catch(e){}
    		if(!store){
    			Gun.log("Warning: No localStorage exists to persist data to!");
    			store = {setItem: function(k,v){this[k]=v;}, removeItem: function(k){delete this[k];}, getItem: function(k){return this[k]}};
    		}
    		var json = JSON.stringifyAsync || function(v,cb,r,s){ var u; try{ cb(u, JSON.stringify(v,r,s)); }catch(e){ cb(e); } };

    		Gun.on('create', function lg(root){
    			this.to.next(root);
    			var opt = root.opt; root.graph; var acks = [], disk, to, size, stop;
    			if(false === opt.localStorage){ return }
    			opt.prefix = opt.file || 'gun/';
    			try{ disk = lg[opt.prefix] = lg[opt.prefix] || JSON.parse(size = store.getItem(opt.prefix)) || {}; // TODO: Perf! This will block, should we care, since limited to 5MB anyways?
    			}catch(e){ disk = lg[opt.prefix] = {}; }
    			size = (size||'').length;

    			root.on('get', function(msg){
    				this.to.next(msg);
    				var lex = msg.get, soul, data, tmp, u;
    				if(!lex || !(soul = lex['#'])){ return }
    				data = disk[soul] || u;
    				if(data && (tmp = lex['.']) && !Object.plain(tmp)){ // pluck!
    					data = Gun.state.ify({}, tmp, Gun.state.is(data, tmp), data[tmp], soul);
    				}
    				//if(data){ (tmp = {})[soul] = data } // back into a graph.
    				//setTimeout(function(){
    				Gun.on.get.ack(msg, data); //root.on('in', {'@': msg['#'], put: tmp, lS:1});// || root.$});
    				//}, Math.random() * 10); // FOR TESTING PURPOSES!
    			});

    			root.on('put', function(msg){
    				this.to.next(msg); // remember to call next middleware adapter
    				var put = msg.put, soul = put['#'], key = put['.'], id = msg['#'], ok = msg.ok||''; // pull data off wire envelope
    				disk[soul] = Gun.state.ify(disk[soul], key, put['>'], put[':'], soul); // merge into disk object
    				if(stop && size > (4999880)){ root.on('in', {'@': id, err: "localStorage max!"}); return; }
    				//if(!msg['@']){ acks.push(id) } // then ack any non-ack write. // TODO: use batch id.
    				if(!msg['@'] && (!msg._.via || Math.random() < (ok['@'] / ok['/']))){ acks.push(id); } // then ack any non-ack write. // TODO: use batch id.
    				if(to){ return }
    				to = setTimeout(flush, 9+(size / 333)); // 0.1MB = 0.3s, 5MB = 15s 
    			});
    			function flush(){
    				if(!acks.length && ((setTimeout.turn||'').s||'').length){ setTimeout(flush,99); return; } // defer if "busy" && no saves.
    				var ack = acks; clearTimeout(to); to = false; acks = [];
    				json(disk, function(err, tmp){
    					try{!err && store.setItem(opt.prefix, tmp);
    					}catch(e){ err = stop = e || "localStorage failure"; }
    					if(err){
    						Gun.log(err + " Consider using GUN's IndexedDB plugin for RAD for more storage space, https://gun.eco/docs/RAD#install");
    						root.on('localStorage:error', {err: err, get: opt.prefix, put: disk});
    					}
    					size = tmp.length;

    					//if(!err && !Object.empty(opt.peers)){ return } // only ack if there are no peers. // Switch this to probabilistic mode
    					setTimeout.each(ack, function(id){
    						root.on('in', {'@': id, err: err, ok: 0}); // localStorage isn't reliable, so make its `ok` code be a low number.
    					},0,99);
    				});
    			}
    		
    		});
    	})(USE, './localStorage');

    }());
    (function(){
    	var u;
    	if(''+u == typeof Gun){ return }
    	var DEP = function(n){ console.warn("Warning! Deprecated internal utility will break in next version:", n); };
    	// Generic javascript utilities.
    	var Type = Gun;
    	//Type.fns = Type.fn = {is: function(fn){ return (!!fn && fn instanceof Function) }}
    	Type.fn = Type.fn || {is: function(fn){ DEP('fn'); return (!!fn && 'function' == typeof fn) }};
    	Type.bi = Type.bi || {is: function(b){ DEP('bi');return (b instanceof Boolean || typeof b == 'boolean') }};
    	Type.num = Type.num || {is: function(n){ DEP('num'); return !list_is(n) && ((n - parseFloat(n) + 1) >= 0 || Infinity === n || -Infinity === n) }};
    	Type.text = Type.text || {is: function(t){ DEP('text'); return (typeof t == 'string') }};
    	Type.text.ify = Type.text.ify || function(t){ DEP('text.ify');
    		if(Type.text.is(t)){ return t }
    		if(typeof JSON !== "undefined"){ return JSON.stringify(t) }
    		return (t && t.toString)? t.toString() : t;
    	};
    	Type.text.random = Type.text.random || function(l, c){ DEP('text.random');
    		var s = '';
    		l = l || 24; // you are not going to make a 0 length random number, so no need to check type
    		c = c || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXZabcdefghijklmnopqrstuvwxyz';
    		while(l > 0){ s += c.charAt(Math.floor(Math.random() * c.length)); l--; }
    		return s;
    	};
    	Type.text.match = Type.text.match || function(t, o){ var tmp, u; DEP('text.match');
    		if('string' !== typeof t){ return false }
    		if('string' == typeof o){ o = {'=': o}; }
    		o = o || {};
    		tmp = (o['='] || o['*'] || o['>'] || o['<']);
    		if(t === tmp){ return true }
    		if(u !== o['=']){ return false }
    		tmp = (o['*'] || o['>'] || o['<']);
    		if(t.slice(0, (tmp||'').length) === tmp){ return true }
    		if(u !== o['*']){ return false }
    		if(u !== o['>'] && u !== o['<']){
    			return (t >= o['>'] && t <= o['<'])? true : false;
    		}
    		if(u !== o['>'] && t >= o['>']){ return true }
    		if(u !== o['<'] && t <= o['<']){ return true }
    		return false;
    	};
    	Type.text.hash = Type.text.hash || function(s, c){ // via SO
    		DEP('text.hash');
    		if(typeof s !== 'string'){ return }
    	  c = c || 0;
    	  if(!s.length){ return c }
    	  for(var i=0,l=s.length,n; i<l; ++i){
    	    n = s.charCodeAt(i);
    	    c = ((c<<5)-c)+n;
    	    c |= 0;
    	  }
    	  return c;
    	};
    	Type.list = Type.list || {is: function(l){ DEP('list'); return (l instanceof Array) }};
    	Type.list.slit = Type.list.slit || Array.prototype.slice;
    	Type.list.sort = Type.list.sort || function(k){ // creates a new sort function based off some key
    		DEP('list.sort');
    		return function(A,B){
    			if(!A || !B){ return 0 } A = A[k]; B = B[k];
    			if(A < B){ return -1 }else if(A > B){ return 1 }
    			else { return 0 }
    		}
    	};
    	Type.list.map = Type.list.map || function(l, c, _){ DEP('list.map'); return obj_map(l, c, _) };
    	Type.list.index = 1; // change this to 0 if you want non-logical, non-mathematical, non-matrix, non-convenient array notation
    	Type.obj = Type.boj || {is: function(o){ DEP('obj'); return o? (o instanceof Object && o.constructor === Object) || Object.prototype.toString.call(o).match(/^\[object (\w+)\]$/)[1] === 'Object' : false }};
    	Type.obj.put = Type.obj.put || function(o, k, v){ DEP('obj.put'); return (o||{})[k] = v, o };
    	Type.obj.has = Type.obj.has || function(o, k){ DEP('obj.has'); return o && Object.prototype.hasOwnProperty.call(o, k) };
    	Type.obj.del = Type.obj.del || function(o, k){ DEP('obj.del'); 
    		if(!o){ return }
    		o[k] = null;
    		delete o[k];
    		return o;
    	};
    	Type.obj.as = Type.obj.as || function(o, k, v, u){ DEP('obj.as'); return o[k] = o[k] || (u === v? {} : v) };
    	Type.obj.ify = Type.obj.ify || function(o){ DEP('obj.ify'); 
    		if(obj_is(o)){ return o }
    		try{o = JSON.parse(o);
    		}catch(e){o={};}		return o;
    	}
    	;(function(){ var u;
    		function map(v,k){
    			if(obj_has(this,k) && u !== this[k]){ return }
    			this[k] = v;
    		}
    		Type.obj.to = Type.obj.to || function(from, to){ DEP('obj.to'); 
    			to = to || {};
    			obj_map(from, map, to);
    			return to;
    		};
    	}());
    	Type.obj.copy = Type.obj.copy || function(o){ DEP('obj.copy'); // because http://web.archive.org/web/20140328224025/http://jsperf.com/cloning-an-object/2
    		return !o? o : JSON.parse(JSON.stringify(o)); // is shockingly faster than anything else, and our data has to be a subset of JSON anyways!
    	}
    	;(function(){
    		function empty(v,i){ var n = this.n, u;
    			if(n && (i === n || (obj_is(n) && obj_has(n, i)))){ return }
    			if(u !== i){ return true }
    		}
    		Type.obj.empty = Type.obj.empty || function(o, n){ DEP('obj.empty'); 
    			if(!o){ return true }
    			return obj_map(o,empty,{n:n})? false : true;
    		};
    	}());
    (function(){
    		function t(k,v){
    			if(2 === arguments.length){
    				t.r = t.r || {};
    				t.r[k] = v;
    				return;
    			} t.r = t.r || [];
    			t.r.push(k);
    		}		var keys = Object.keys, map;
    		Object.keys = Object.keys || function(o){ return map(o, function(v,k,t){t(k);}) };
    		Type.obj.map = map = Type.obj.map || function(l, c, _){ DEP('obj.map'); 
    			var u, i = 0, x, r, ll, lle, f = 'function' == typeof c;
    			t.r = u;
    			if(keys && obj_is(l)){
    				ll = keys(l); lle = true;
    			}
    			_ = _ || {};
    			if(list_is(l) || ll){
    				x = (ll || l).length;
    				for(;i < x; i++){
    					var ii = (i + Type.list.index);
    					if(f){
    						r = lle? c.call(_, l[ll[i]], ll[i], t) : c.call(_, l[i], ii, t);
    						if(r !== u){ return r }
    					} else {
    						//if(Type.test.is(c,l[i])){ return ii } // should implement deep equality testing!
    						if(c === l[lle? ll[i] : i]){ return ll? ll[i] : ii } // use this for now
    					}
    				}
    			} else {
    				for(i in l){
    					if(f){
    						if(obj_has(l,i)){
    							r = _? c.call(_, l[i], i, t) : c(l[i], i, t);
    							if(r !== u){ return r }
    						}
    					} else {
    						//if(a.test.is(c,l[i])){ return i } // should implement deep equality testing!
    						if(c === l[i]){ return i } // use this for now
    					}
    				}
    			}
    			return f? t.r : Type.list.index? 0 : -1;
    		};
    	}());
    	Type.time = Type.time || {};
    	Type.time.is = Type.time.is || function(t){ DEP('time'); return t? t instanceof Date : (+new Date().getTime()) };

    	var fn_is = Type.fn.is;
    	var list_is = Type.list.is;
    	var obj = Type.obj, obj_is = obj.is, obj_has = obj.has, obj_map = obj.map;

    	var Val = {};
    	Val.is = function(v){ DEP('val.is'); // Valid values are a subset of JSON: null, binary, number (!Infinity), text, or a soul relation. Arrays need special algorithms to handle concurrency, so they are not supported directly. Use an extension that supports them if needed but research their problems first.
    		if(v === u){ return false }
    		if(v === null){ return true } // "deletes", nulling out keys.
    		if(v === Infinity){ return false } // we want this to be, but JSON does not support it, sad face.
    		if(text_is(v) // by "text" we mean strings.
    		|| bi_is(v) // by "binary" we mean boolean.
    		|| num_is(v)){ // by "number" we mean integers or decimals.
    			return true; // simple values are valid.
    		}
    		return Val.link.is(v) || false; // is the value a soul relation? Then it is valid and return it. If not, everything else remaining is an invalid data type. Custom extensions can be built on top of these primitives to support other types.
    	};
    	Val.link = Val.rel = {_: '#'};
    (function(){
    		Val.link.is = function(v){ DEP('val.link.is'); // this defines whether an object is a soul relation or not, they look like this: {'#': 'UUID'}
    			if(v && v[rel_] && !v._ && obj_is(v)){ // must be an object.
    				var o = {};
    				obj_map(v, map, o);
    				if(o.id){ // a valid id was found.
    					return o.id; // yay! Return it.
    				}
    			}
    			return false; // the value was not a valid soul relation.
    		};
    		function map(s, k){ var o = this; // map over the object...
    			if(o.id){ return o.id = false } // if ID is already defined AND we're still looping through the object, it is considered invalid.
    			if(k == rel_ && text_is(s)){ // the key should be '#' and have a text value.
    				o.id = s; // we found the soul!
    			} else {
    				return o.id = false; // if there exists anything else on the object that isn't the soul, then it is considered invalid.
    			}
    		}
    	}());
    	Val.link.ify = function(t){ DEP('val.link.ify'); return obj_put({}, rel_, t) }; // convert a soul into a relation and return it.
    	Type.obj.has._ = '.';
    	var rel_ = Val.link._, u;
    	var bi_is = Type.bi.is;
    	var num_is = Type.num.is;
    	var text_is = Type.text.is;
    	var obj = Type.obj, obj_is = obj.is, obj_put = obj.put, obj_map = obj.map;

    	Type.val = Type.val || Val;

    	var Node = {_: '_'};
    	Node.soul = function(n, o){ DEP('node.soul'); return (n && n._ && n._[o || soul_]) }; // convenience function to check to see if there is a soul on a node and return it.
    	Node.soul.ify = function(n, o){ DEP('node.soul.ify'); // put a soul on an object.
    		o = (typeof o === 'string')? {soul: o} : o || {};
    		n = n || {}; // make sure it exists.
    		n._ = n._ || {}; // make sure meta exists.
    		n._[soul_] = o.soul || n._[soul_] || text_random(); // put the soul on it.
    		return n;
    	};
    	Node.soul._ = Val.link._;
    (function(){
    		Node.is = function(n, cb, as){ DEP('node.is'); var s; // checks to see if an object is a valid node.
    			if(!obj_is(n)){ return false } // must be an object.
    			if(s = Node.soul(n)){ // must have a soul on it.
    				return !obj_map(n, map, {as:as,cb:cb,s:s,n:n});
    			}
    			return false; // nope! This was not a valid node.
    		};
    		function map(v, k){ // we invert this because the way we check for this is via a negation.
    			if(k === Node._){ return } // skip over the metadata.
    			if(!Val.is(v)){ return true } // it is true that this is an invalid node.
    			if(this.cb){ this.cb.call(this.as, v, k, this.n, this.s); } // optionally callback each key/value.
    		}
    	}());
    (function(){
    		Node.ify = function(obj, o, as){ DEP('node.ify'); // returns a node from a shallow object.
    			if(!o){ o = {}; }
    			else if(typeof o === 'string'){ o = {soul: o}; }
    			else if('function' == typeof o){ o = {map: o}; }
    			if(o.map){ o.node = o.map.call(as, obj, u, o.node || {}); }
    			if(o.node = Node.soul.ify(o.node || {}, o)){
    				obj_map(obj, map, {o:o,as:as});
    			}
    			return o.node; // This will only be a valid node if the object wasn't already deep!
    		};
    		function map(v, k){ var o = this.o, tmp, u; // iterate over each key/value.
    			if(o.map){
    				tmp = o.map.call(this.as, v, ''+k, o.node);
    				if(u === tmp){
    					obj_del(o.node, k);
    				} else
    				if(o.node){ o.node[k] = tmp; }
    				return;
    			}
    			if(Val.is(v)){
    				o.node[k] = v;
    			}
    		}
    	}());
    	var obj = Type.obj, obj_is = obj.is, obj_del = obj.del, obj_map = obj.map;
    	var text = Type.text, text_random = text.random;
    	var soul_ = Node.soul._;
    	var u;
    	Type.node = Type.node || Node;

    	var State = Type.state;
    	State.lex = function(){ DEP('state.lex'); return State().toString(36).replace('.','') };
    	State.to = function(from, k, to){ DEP('state.to'); 
    		var val = (from||{})[k];
    		if(obj_is(val)){
    			val = obj_copy(val);
    		}
    		return State.ify(to, k, State.is(from, k), val, Node.soul(from));
    	}
    	;(function(){
    		State.map = function(cb, s, as){ DEP('state.map'); var u; // for use with Node.ify
    			var o = obj_is(o = cb || s)? o : null;
    			cb = fn_is(cb = cb || s)? cb : null;
    			if(o && !cb){
    				s = num_is(s)? s : State();
    				o[N_] = o[N_] || {};
    				obj_map(o, map, {o:o,s:s});
    				return o;
    			}
    			as = as || obj_is(s)? s : u;
    			s = num_is(s)? s : State();
    			return function(v, k, o, opt){
    				if(!cb){
    					map.call({o: o, s: s}, v,k);
    					return v;
    				}
    				cb.call(as || this || {}, v, k, o, opt);
    				if(obj_has(o,k) && u === o[k]){ return }
    				map.call({o: o, s: s}, v,k);
    			}
    		};
    		function map(v,k){
    			if(N_ === k){ return }
    			State.ify(this.o, k, this.s) ;
    		}
    	}());
    	var obj = Type.obj; obj.as; var obj_has = obj.has, obj_is = obj.is, obj_map = obj.map, obj_copy = obj.copy;
    	var num = Type.num, num_is = num.is;
    	var fn = Type.fn, fn_is = fn.is;
    	var N_ = Node._, u;

    	var Graph = {};
    (function(){
    		Graph.is = function(g, cb, fn, as){ DEP('graph.is'); // checks to see if an object is a valid graph.
    			if(!g || !obj_is(g) || obj_empty(g)){ return false } // must be an object.
    			return !obj_map(g, map, {cb:cb,fn:fn,as:as}); // makes sure it wasn't an empty object.
    		};
    		function map(n, s){ // we invert this because the way'? we check for this is via a negation.
    			if(!n || s !== Node.soul(n) || !Node.is(n, this.fn, this.as)){ return true } // it is true that this is an invalid graph.
    			if(!this.cb){ return }
    			nf.n = n; nf.as = this.as; // sequential race conditions aren't races.
    			this.cb.call(nf.as, n, s, nf);
    		}
    		function nf(fn){ // optional callback for each node.
    			if(fn){ Node.is(nf.n, fn, nf.as); } // where we then have an optional callback for each key/value.
    		}
    	}());
    (function(){
    		Graph.ify = function(obj, env, as){ DEP('graph.ify'); 
    			var at = {path: [], obj: obj};
    			if(!env){
    				env = {};
    			} else
    			if(typeof env === 'string'){
    				env = {soul: env};
    			} else
    			if('function' == typeof env){
    				env.map = env;
    			}
    			if(typeof as === 'string'){
    				env.soul = env.soul || as;
    				as = u;
    			}
    			if(env.soul){
    				at.link = Val.link.ify(env.soul);
    			}
    			env.shell = (as||{}).shell;
    			env.graph = env.graph || {};
    			env.seen = env.seen || [];
    			env.as = env.as || as;
    			node(env, at);
    			env.root = at.node;
    			return env.graph;
    		};
    		function node(env, at){ var tmp;
    			if(tmp = seen(env, at)){ return tmp }
    			at.env = env;
    			at.soul = soul;
    			if(Node.ify(at.obj, map, at)){
    				at.link = at.link || Val.link.ify(Node.soul(at.node));
    				if(at.obj !== env.shell){
    					env.graph[Val.link.is(at.link)] = at.node;
    				}
    			}
    			return at;
    		}
    		function map(v,k,n){
    			var at = this, env = at.env, is, tmp;
    			if(Node._ === k && obj_has(v,Val.link._)){
    				return n._; // TODO: Bug?
    			}
    			if(!(is = valid(v,k,n, at,env))){ return }
    			if(!k){
    				at.node = at.node || n || {};
    				if(obj_has(v, Node._) && Node.soul(v)){ // ? for safety ?
    					at.node._ = obj_copy(v._);
    				}
    				at.node = Node.soul.ify(at.node, Val.link.is(at.link));
    				at.link = at.link || Val.link.ify(Node.soul(at.node));
    			}
    			if(tmp = env.map){
    				tmp.call(env.as || {}, v,k,n, at);
    				if(obj_has(n,k)){
    					v = n[k];
    					if(u === v){
    						obj_del(n, k);
    						return;
    					}
    					if(!(is = valid(v,k,n, at,env))){ return }
    				}
    			}
    			if(!k){ return at.node }
    			if(true === is){
    				return v;
    			}
    			tmp = node(env, {obj: v, path: at.path.concat(k)});
    			if(!tmp.node){ return }
    			return tmp.link; //{'#': Node.soul(tmp.node)};
    		}
    		function soul(id){ var at = this;
    			var prev = Val.link.is(at.link), graph = at.env.graph;
    			at.link = at.link || Val.link.ify(id);
    			at.link[Val.link._] = id;
    			if(at.node && at.node[Node._]){
    				at.node[Node._][Val.link._] = id;
    			}
    			if(obj_has(graph, prev)){
    				graph[id] = graph[prev];
    				obj_del(graph, prev);
    			}
    		}
    		function valid(v,k,n, at,env){ var tmp;
    			if(Val.is(v)){ return true }
    			if(obj_is(v)){ return 1 }
    			if(tmp = env.invalid){
    				v = tmp.call(env.as || {}, v,k,n);
    				return valid(v,k,n, at,env);
    			}
    			env.err = "Invalid value at '" + at.path.concat(k).join('.') + "'!";
    			if(Type.list.is(v)){ env.err += " Use `.set(item)` instead of an Array."; }
    		}
    		function seen(env, at){
    			var arr = env.seen, i = arr.length, has;
    			while(i--){ has = arr[i];
    				if(at.obj === has.obj){ return has }
    			}
    			arr.push(at);
    		}
    	}());
    	Graph.node = function(node){ DEP('graph.node'); 
    		var soul = Node.soul(node);
    		if(!soul){ return }
    		return obj_put({}, soul, node);
    	}
    	;(function(){
    		Graph.to = function(graph, root, opt){ DEP('graph.to'); 
    			if(!graph){ return }
    			var obj = {};
    			opt = opt || {seen: {}};
    			obj_map(graph[root], map, {obj:obj, graph: graph, opt: opt});
    			return obj;
    		};
    		function map(v,k){ var tmp, obj;
    			if(Node._ === k){
    				if(obj_empty(v, Val.link._)){
    					return;
    				}
    				this.obj[k] = obj_copy(v);
    				return;
    			}
    			if(!(tmp = Val.link.is(v))){
    				this.obj[k] = v;
    				return;
    			}
    			if(obj = this.opt.seen[tmp]){
    				this.obj[k] = obj;
    				return;
    			}
    			this.obj[k] = this.opt.seen[tmp] = Graph.to(this.graph, tmp, this.opt);
    		}
    	}());
    	var fn_is = Type.fn.is;
    	var obj = Type.obj, obj_is = obj.is, obj_del = obj.del, obj_has = obj.has, obj_empty = obj.empty, obj_put = obj.put, obj_map = obj.map, obj_copy = obj.copy;
    	var u;
    	Type.graph = Type.graph || Graph;
    }());
    });

    var browser = gun;

    createCommonjsModule(function (module) {
    (function(){

      /* UNBUILD */
      function USE(arg, req){
        return req? commonjsRequire(arg) : arg.slice? USE[R(arg)] : function(mod, path){
          arg(mod = {exports: {}});
          USE[R(path)] = mod.exports;
        }
        function R(p){
          return p.split('/').slice(-1).toString().replace('.js','');
        }
      }
      { var MODULE = module; }
    USE(function(module){
        // Security, Encryption, and Authorization: SEA.js
        // MANDATORY READING: https://gun.eco/explainers/data/security.html
        // IT IS IMPLEMENTED IN A POLYFILL/SHIM APPROACH.
        // THIS IS AN EARLY ALPHA!

        if(typeof self !== "undefined"){ module.window = self; } // should be safe for at least browser/worker/nodejs, need to check other envs like RN etc.
        if(typeof window !== "undefined"){ module.window = window; }

        var tmp = module.window || module, u;
        var SEA = tmp.SEA || {};

        if(SEA.window = module.window){ SEA.window.SEA = SEA; }

        try{ if(u+'' !== typeof MODULE){ MODULE.exports = SEA; } }catch(e){}
        module.exports = SEA;
      })(USE, './root');
    USE(function(module){
        var SEA = USE('./root');
        try{ if(SEA.window){
          if(location.protocol.indexOf('s') < 0
          && location.host.indexOf('localhost') < 0
          && ! /^127\.\d+\.\d+\.\d+$/.test(location.hostname)
          && location.protocol.indexOf('file:') < 0){
            console.warn('HTTPS needed for WebCrypto in SEA, redirecting...');
            location.protocol = 'https:'; // WebCrypto does NOT work without HTTPS!
          }
        } }catch(e){}
      })(USE, './https');
    USE(function(module){
        var u;
        if(u+''== typeof btoa){
          if(u+'' == typeof Buffer){
            try{ commonjsGlobal.Buffer = USE("buffer", 1).Buffer; }catch(e){ console.log("Please `npm install buffer` or add it to your package.json !"); }
          }
          commonjsGlobal.btoa = function(data){ return Buffer.from(data, "binary").toString("base64") };
          commonjsGlobal.atob = function(data){ return Buffer.from(data, "base64").toString("binary") };
        }
      })(USE, './base64');
    USE(function(module){
        USE('./base64');
        // This is Array extended to have .toString(['utf8'|'hex'|'base64'])
        function SeaArray() {}
        Object.assign(SeaArray, { from: Array.from });
        SeaArray.prototype = Object.create(Array.prototype);
        SeaArray.prototype.toString = function(enc, start, end) { enc = enc || 'utf8'; start = start || 0;
          const length = this.length;
          if (enc === 'hex') {
            const buf = new Uint8Array(this);
            return [ ...Array(((end && (end + 1)) || length) - start).keys()]
            .map((i) => buf[ i + start ].toString(16).padStart(2, '0')).join('')
          }
          if (enc === 'utf8') {
            return Array.from(
              { length: (end || length) - start },
              (_, i) => String.fromCharCode(this[ i + start])
            ).join('')
          }
          if (enc === 'base64') {
            return btoa(this)
          }
        };
        module.exports = SeaArray;
      })(USE, './array');
    USE(function(module){
        USE('./base64');
        // This is Buffer implementation used in SEA. Functionality is mostly
        // compatible with NodeJS 'safe-buffer' and is used for encoding conversions
        // between binary and 'hex' | 'utf8' | 'base64'
        // See documentation and validation for safe implementation in:
        // https://github.com/feross/safe-buffer#update
        var SeaArray = USE('./array');
        function SafeBuffer(...props) {
          console.warn('new SafeBuffer() is depreciated, please use SafeBuffer.from()');
          return SafeBuffer.from(...props)
        }
        SafeBuffer.prototype = Object.create(Array.prototype);
        Object.assign(SafeBuffer, {
          // (data, enc) where typeof data === 'string' then enc === 'utf8'|'hex'|'base64'
          from() {
            if (!Object.keys(arguments).length || arguments[0]==null) {
              throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
            }
            const input = arguments[0];
            let buf;
            if (typeof input === 'string') {
              const enc = arguments[1] || 'utf8';
              if (enc === 'hex') {
                const bytes = input.match(/([\da-fA-F]{2})/g)
                .map((byte) => parseInt(byte, 16));
                if (!bytes || !bytes.length) {
                  throw new TypeError('Invalid first argument for type \'hex\'.')
                }
                buf = SeaArray.from(bytes);
              } else if (enc === 'utf8' || 'binary' === enc) { // EDIT BY MARK: I think this is safe, tested it against a couple "binary" strings. This lets SafeBuffer match NodeJS Buffer behavior more where it safely btoas regular strings.
                const length = input.length;
                const words = new Uint16Array(length);
                Array.from({ length: length }, (_, i) => words[i] = input.charCodeAt(i));
                buf = SeaArray.from(words);
              } else if (enc === 'base64') {
                const dec = atob(input);
                const length = dec.length;
                const bytes = new Uint8Array(length);
                Array.from({ length: length }, (_, i) => bytes[i] = dec.charCodeAt(i));
                buf = SeaArray.from(bytes);
              } else if (enc === 'binary') { // deprecated by above comment
                buf = SeaArray.from(input); // some btoas were mishandled.
              } else {
                console.info('SafeBuffer.from unknown encoding: '+enc);
              }
              return buf
            }
            input.byteLength; // what is going on here? FOR MARTTI
            const length = input.byteLength ? input.byteLength : input.length;
            if (length) {
              let buf;
              if (input instanceof ArrayBuffer) {
                buf = new Uint8Array(input);
              }
              return SeaArray.from(buf || input)
            }
          },
          // This is 'safe-buffer.alloc' sans encoding support
          alloc(length, fill = 0 /*, enc*/ ) {
            return SeaArray.from(new Uint8Array(Array.from({ length: length }, () => fill)))
          },
          // This is normal UNSAFE 'buffer.alloc' or 'new Buffer(length)' - don't use!
          allocUnsafe(length) {
            return SeaArray.from(new Uint8Array(Array.from({ length : length })))
          },
          // This puts together array of array like members
          concat(arr) { // octet array
            if (!Array.isArray(arr)) {
              throw new TypeError('First argument must be Array containing ArrayBuffer or Uint8Array instances.')
            }
            return SeaArray.from(arr.reduce((ret, item) => ret.concat(Array.from(item)), []))
          }
        });
        SafeBuffer.prototype.from = SafeBuffer.from;
        SafeBuffer.prototype.toString = SeaArray.prototype.toString;

        module.exports = SafeBuffer;
      })(USE, './buffer');
    USE(function(module){
        const SEA = USE('./root');
        const api = {Buffer: USE('./buffer')};
        var o = {}, u;

        // ideally we can move away from JSON entirely? unlikely due to compatibility issues... oh well.
        JSON.parseAsync = JSON.parseAsync || function(t,cb,r){ var u; try{ cb(u, JSON.parse(t,r)); }catch(e){ cb(e); } };
        JSON.stringifyAsync = JSON.stringifyAsync || function(v,cb,r,s){ var u; try{ cb(u, JSON.stringify(v,r,s)); }catch(e){ cb(e); } };

        api.parse = function(t,r){ return new Promise(function(res, rej){
          JSON.parseAsync(t,function(err, raw){ err? rej(err) : res(raw); },r);
        })};
        api.stringify = function(v,r,s){ return new Promise(function(res, rej){
          JSON.stringifyAsync(v,function(err, raw){ err? rej(err) : res(raw); },r,s);
        })};

        if(SEA.window){
          api.crypto = SEA.window.crypto || SEA.window.msCrypto;
          api.subtle = (api.crypto||o).subtle || (api.crypto||o).webkitSubtle;
          api.TextEncoder = SEA.window.TextEncoder;
          api.TextDecoder = SEA.window.TextDecoder;
          api.random = (len) => api.Buffer.from(api.crypto.getRandomValues(new Uint8Array(api.Buffer.alloc(len))));
        }
        if(!api.TextDecoder)
        {
          const { TextEncoder, TextDecoder } = USE((u+'' == typeof MODULE?'.':'')+'./lib/text-encoding', 1);
          api.TextDecoder = TextDecoder;
          api.TextEncoder = TextEncoder;
        }
        if(!api.crypto)
        {
          try
          {
          var crypto = USE('crypto', 1);
          Object.assign(api, {
            crypto,
            random: (len) => api.Buffer.from(crypto.randomBytes(len))
          });      
          const { Crypto: WebCrypto } = USE('@peculiar/webcrypto', 1);
          api.ossl = api.subtle = new WebCrypto({directory: 'ossl'}).subtle; // ECDH
        }
        catch(e){
          console.log("Please `npm install @peculiar/webcrypto` or add it to your package.json !");
        }}

        module.exports = api;
      })(USE, './shim');
    USE(function(module){
        var SEA = USE('./root');
        var shim = USE('./shim');
        var s = {};
        s.pbkdf2 = {hash: {name : 'SHA-256'}, iter: 100000, ks: 64};
        s.ecdsa = {
          pair: {name: 'ECDSA', namedCurve: 'P-256'},
          sign: {name: 'ECDSA', hash: {name: 'SHA-256'}}
        };
        s.ecdh = {name: 'ECDH', namedCurve: 'P-256'};

        // This creates Web Cryptography API compliant JWK for sign/verify purposes
        s.jwk = function(pub, d){  // d === priv
          pub = pub.split('.');
          var x = pub[0], y = pub[1];
          var jwk = {kty: "EC", crv: "P-256", x: x, y: y, ext: true};
          jwk.key_ops = d ? ['sign'] : ['verify'];
          if(d){ jwk.d = d; }
          return jwk;
        };
        
        s.keyToJwk = function(keyBytes) {
          const keyB64 = keyBytes.toString('base64');
          const k = keyB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=/g, '');
          return { kty: 'oct', k: k, ext: false, alg: 'A256GCM' };
        };

        s.recall = {
          validity: 12 * 60 * 60, // internally in seconds : 12 hours
          hook: function(props){ return props } // { iat, exp, alias, remember } // or return new Promise((resolve, reject) => resolve(props)
        };

        s.check = function(t){ return (typeof t == 'string') && ('SEA{' === t.slice(0,4)) };
        s.parse = async function p(t){ try {
          var yes = (typeof t == 'string');
          if(yes && 'SEA{' === t.slice(0,4)){ t = t.slice(3); }
          return yes ? await shim.parse(t) : t;
          } catch (e) {}
          return t;
        };

        SEA.opt = s;
        module.exports = s;
      })(USE, './settings');
    USE(function(module){
        var shim = USE('./shim');
        module.exports = async function(d, o){
          var t = (typeof d == 'string')? d : await shim.stringify(d);
          var hash = await shim.subtle.digest({name: o||'SHA-256'}, new shim.TextEncoder().encode(t));
          return shim.Buffer.from(hash);
        };
      })(USE, './sha256');
    USE(function(module){
        // This internal func returns SHA-1 hashed data for KeyID generation
        const __shim = USE('./shim');
        const subtle = __shim.subtle;
        const ossl = __shim.ossl ? __shim.ossl : subtle;
        const sha1hash = (b) => ossl.digest({name: 'SHA-1'}, new ArrayBuffer(b));
        module.exports = sha1hash;
      })(USE, './sha1');
    USE(function(module){
        var SEA = USE('./root');
        var shim = USE('./shim');
        var S = USE('./settings');
        var sha = USE('./sha256');
        var u;

        SEA.work = SEA.work || (async (data, pair, cb, opt) => { try { // used to be named `proof`
          var salt = (pair||{}).epub || pair; // epub not recommended, salt should be random!
          opt = opt || {};
          if(salt instanceof Function){
            cb = salt;
            salt = u;
          }
          data = (typeof data == 'string')? data : await shim.stringify(data);
          if('sha' === (opt.name||'').toLowerCase().slice(0,3)){
            var rsha = shim.Buffer.from(await sha(data, opt.name), 'binary').toString(opt.encode || 'base64');
            if(cb){ try{ cb(rsha); }catch(e){console.log(e);} }
            return rsha;
          }
          salt = salt || shim.random(9);
          var key = await (shim.ossl || shim.subtle).importKey('raw', new shim.TextEncoder().encode(data), {name: opt.name || 'PBKDF2'}, false, ['deriveBits']);
          var work = await (shim.ossl || shim.subtle).deriveBits({
            name: opt.name || 'PBKDF2',
            iterations: opt.iterations || S.pbkdf2.iter,
            salt: new shim.TextEncoder().encode(opt.salt || salt),
            hash: opt.hash || S.pbkdf2.hash,
          }, key, opt.length || (S.pbkdf2.ks * 8));
          data = shim.random(data.length);  // Erase data in case of passphrase
          var r = shim.Buffer.from(work, 'binary').toString(opt.encode || 'base64');
          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        } catch(e) { 
          console.log(e);
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        module.exports = SEA.work;
      })(USE, './work');
    USE(function(module){
        var SEA = USE('./root');
        var shim = USE('./shim');
        USE('./settings');

        SEA.name = SEA.name || (async (cb, opt) => { try {
          if(cb){ try{ cb(); }catch(e){console.log(e);} }
          return;
        } catch(e) {
          console.log(e);
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        //SEA.pair = async (data, proof, cb) => { try {
        SEA.pair = SEA.pair || (async (cb, opt) => { try {

          var ecdhSubtle = shim.ossl || shim.subtle;
          // First: ECDSA keys for signing/verifying...
          var sa = await shim.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, [ 'sign', 'verify' ])
          .then(async (keys) => {
            // privateKey scope doesn't leak out from here!
            //const { d: priv } = await shim.subtle.exportKey('jwk', keys.privateKey)
            var key = {};
            key.priv = (await shim.subtle.exportKey('jwk', keys.privateKey)).d;
            var pub = await shim.subtle.exportKey('jwk', keys.publicKey);
            //const pub = Buff.from([ x, y ].join(':')).toString('base64') // old
            key.pub = pub.x+'.'+pub.y; // new
            // x and y are already base64
            // pub is UTF8 but filename/URL safe (https://www.ietf.org/rfc/rfc3986.txt)
            // but split on a non-base64 letter.
            return key;
          });
          
          // To include PGPv4 kind of keyId:
          // const pubId = await SEA.keyid(keys.pub)
          // Next: ECDH keys for encryption/decryption...

          try{
          var dh = await ecdhSubtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveKey'])
          .then(async (keys) => {
            // privateKey scope doesn't leak out from here!
            var key = {};
            key.epriv = (await ecdhSubtle.exportKey('jwk', keys.privateKey)).d;
            var pub = await ecdhSubtle.exportKey('jwk', keys.publicKey);
            //const epub = Buff.from([ ex, ey ].join(':')).toString('base64') // old
            key.epub = pub.x+'.'+pub.y; // new
            // ex and ey are already base64
            // epub is UTF8 but filename/URL safe (https://www.ietf.org/rfc/rfc3986.txt)
            // but split on a non-base64 letter.
            return key;
          });
          }catch(e){
            if(SEA.window){ throw e }
            if(e == 'Error: ECDH is not a supported algorithm'){ console.log('Ignoring ECDH...'); }
            else { throw e }
          } dh = dh || {};

          var r = { pub: sa.pub, priv: sa.priv, /* pubId, */ epub: dh.epub, epriv: dh.epriv };
          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        } catch(e) {
          console.log(e);
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        module.exports = SEA.pair;
      })(USE, './pair');
    USE(function(module){
        var SEA = USE('./root');
        var shim = USE('./shim');
        var S = USE('./settings');
        var sha = USE('./sha256');
        var u;

        SEA.sign = SEA.sign || (async (data, pair, cb, opt) => { try {
          opt = opt || {};
          if(!(pair||opt).priv){
            if(!SEA.I){ throw 'No signing key.' }
            pair = await SEA.I(null, {what: data, how: 'sign', why: opt.why});
          }
          if(u === data){ throw '`undefined` not allowed.' }
          var json = await S.parse(data);
          var check = opt.check = opt.check || json;
          if(SEA.verify && (SEA.opt.check(check) || (check && check.s && check.m))
          && u !== await SEA.verify(check, pair)){ // don't sign if we already signed it.
            var r = await S.parse(check);
            if(!opt.raw){ r = 'SEA' + await shim.stringify(r); }
            if(cb){ try{ cb(r); }catch(e){console.log(e);} }
            return r;
          }
          var pub = pair.pub;
          var priv = pair.priv;
          var jwk = S.jwk(pub, priv);
          var hash = await sha(json);
          var sig = await (shim.ossl || shim.subtle).importKey('jwk', jwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign'])
          .then((key) => (shim.ossl || shim.subtle).sign({name: 'ECDSA', hash: {name: 'SHA-256'}}, key, new Uint8Array(hash))); // privateKey scope doesn't leak out from here!
          var r = {m: json, s: shim.Buffer.from(sig, 'binary').toString(opt.encode || 'base64')};
          if(!opt.raw){ r = 'SEA' + await shim.stringify(r); }

          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        } catch(e) {
          console.log(e);
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        module.exports = SEA.sign;
      })(USE, './sign');
    USE(function(module){
        var SEA = USE('./root');
        var shim = USE('./shim');
        var S = USE('./settings');
        var sha = USE('./sha256');
        var u;

        SEA.verify = SEA.verify || (async (data, pair, cb, opt) => { try {
          var json = await S.parse(data);
          if(false === pair){ // don't verify!
            var raw = await S.parse(json.m);
            if(cb){ try{ cb(raw); }catch(e){console.log(e);} }
            return raw;
          }
          opt = opt || {};
          // SEA.I // verify is free! Requires no user permission.
          var pub = pair.pub || pair;
          var key = SEA.opt.slow_leak? await SEA.opt.slow_leak(pub) : await (shim.ossl || shim.subtle).importKey('jwk', S.jwk(pub), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
          var hash = await sha(json.m);
          var buf, sig, check, tmp; try{
            buf = shim.Buffer.from(json.s, opt.encode || 'base64'); // NEW DEFAULT!
            sig = new Uint8Array(buf);
            check = await (shim.ossl || shim.subtle).verify({name: 'ECDSA', hash: {name: 'SHA-256'}}, key, sig, new Uint8Array(hash));
            if(!check){ throw "Signature did not match." }
          }catch(e){
            if(SEA.opt.fallback){
              return await SEA.opt.fall_verify(data, pair, cb, opt);
            }
          }
          var r = check? await S.parse(json.m) : u;

          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        } catch(e) {
          console.log(e); // mismatched owner FOR MARTTI
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        module.exports = SEA.verify;
        // legacy & ossl memory leak mitigation:

        var knownKeys = {};
        SEA.opt.slow_leak = pair => {
          if (knownKeys[pair]) return knownKeys[pair];
          var jwk = S.jwk(pair);
          knownKeys[pair] = (shim.ossl || shim.subtle).importKey("jwk", jwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ["verify"]);
          return knownKeys[pair];
        };

        var O = SEA.opt;
        SEA.opt.fall_verify = async function(data, pair, cb, opt, f){
          if(f === SEA.opt.fallback){ throw "Signature did not match" } f = f || 1;
          var tmp = data||'';
          data = SEA.opt.unpack(data) || data;
          var json = await S.parse(data), pub = pair.pub || pair, key = await SEA.opt.slow_leak(pub);
          var hash = (f <= SEA.opt.fallback)? shim.Buffer.from(await shim.subtle.digest({name: 'SHA-256'}, new shim.TextEncoder().encode(await S.parse(json.m)))) : await sha(json.m); // this line is old bad buggy code but necessary for old compatibility.
          var buf; var sig; var check; try{
            buf = shim.Buffer.from(json.s, opt.encode || 'base64'); // NEW DEFAULT!
            sig = new Uint8Array(buf);
            check = await (shim.ossl || shim.subtle).verify({name: 'ECDSA', hash: {name: 'SHA-256'}}, key, sig, new Uint8Array(hash));
            if(!check){ throw "Signature did not match." }
          }catch(e){ try{
            buf = shim.Buffer.from(json.s, 'utf8'); // AUTO BACKWARD OLD UTF8 DATA!
            sig = new Uint8Array(buf);
            check = await (shim.ossl || shim.subtle).verify({name: 'ECDSA', hash: {name: 'SHA-256'}}, key, sig, new Uint8Array(hash));
            }catch(e){
            if(!check){ throw "Signature did not match." }
            }
          }
          var r = check? await S.parse(json.m) : u;
          O.fall_soul = tmp['#']; O.fall_key = tmp['.']; O.fall_val = data; O.fall_state = tmp['>'];
          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        };
        SEA.opt.fallback = 2;

      })(USE, './verify');
    USE(function(module){
        var shim = USE('./shim');
        var S = USE('./settings');
        var sha256hash = USE('./sha256');

        const importGen = async (key, salt, opt) => {
          const combo = key + (salt || shim.random(8)).toString('utf8'); // new
          const hash = shim.Buffer.from(await sha256hash(combo), 'binary');
          
          const jwkKey = S.keyToJwk(hash);      
          return await shim.subtle.importKey('jwk', jwkKey, {name:'AES-GCM'}, false, ['encrypt', 'decrypt'])
        };
        module.exports = importGen;
      })(USE, './aeskey');
    USE(function(module){
        var SEA = USE('./root');
        var shim = USE('./shim');
        USE('./settings');
        var aeskey = USE('./aeskey');
        var u;

        SEA.encrypt = SEA.encrypt || (async (data, pair, cb, opt) => { try {
          opt = opt || {};
          var key = (pair||opt).epriv || pair;
          if(u === data){ throw '`undefined` not allowed.' }
          if(!key){
            if(!SEA.I){ throw 'No encryption key.' }
            pair = await SEA.I(null, {what: data, how: 'encrypt', why: opt.why});
            key = pair.epriv || pair;
          }
          var msg = (typeof data == 'string')? data : await shim.stringify(data);
          var rand = {s: shim.random(9), iv: shim.random(15)}; // consider making this 9 and 15 or 18 or 12 to reduce == padding.
          var ct = await aeskey(key, rand.s, opt).then((aes) => (/*shim.ossl ||*/ shim.subtle).encrypt({ // Keeping the AES key scope as private as possible...
            name: opt.name || 'AES-GCM', iv: new Uint8Array(rand.iv)
          }, aes, new shim.TextEncoder().encode(msg)));
          var r = {
            ct: shim.Buffer.from(ct, 'binary').toString(opt.encode || 'base64'),
            iv: rand.iv.toString(opt.encode || 'base64'),
            s: rand.s.toString(opt.encode || 'base64')
          };
          if(!opt.raw){ r = 'SEA' + await shim.stringify(r); }

          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        } catch(e) { 
          console.log(e);
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        module.exports = SEA.encrypt;
      })(USE, './encrypt');
    USE(function(module){
        var SEA = USE('./root');
        var shim = USE('./shim');
        var S = USE('./settings');
        var aeskey = USE('./aeskey');

        SEA.decrypt = SEA.decrypt || (async (data, pair, cb, opt) => { try {
          opt = opt || {};
          var key = (pair||opt).epriv || pair;
          if(!key){
            if(!SEA.I){ throw 'No decryption key.' }
            pair = await SEA.I(null, {what: data, how: 'decrypt', why: opt.why});
            key = pair.epriv || pair;
          }
          var json = await S.parse(data);
          var buf, bufiv, bufct; try{
            buf = shim.Buffer.from(json.s, opt.encode || 'base64');
            bufiv = shim.Buffer.from(json.iv, opt.encode || 'base64');
            bufct = shim.Buffer.from(json.ct, opt.encode || 'base64');
            var ct = await aeskey(key, buf, opt).then((aes) => (/*shim.ossl ||*/ shim.subtle).decrypt({  // Keeping aesKey scope as private as possible...
              name: opt.name || 'AES-GCM', iv: new Uint8Array(bufiv), tagLength: 128
            }, aes, new Uint8Array(bufct)));
          }catch(e){
            if('utf8' === opt.encode){ throw "Could not decrypt" }
            if(SEA.opt.fallback){
              opt.encode = 'utf8';
              return await SEA.decrypt(data, pair, cb, opt);
            }
          }
          var r = await S.parse(new shim.TextDecoder('utf8').decode(ct));
          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        } catch(e) { 
          console.log(e);
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        module.exports = SEA.decrypt;
      })(USE, './decrypt');
    USE(function(module){
        var SEA = USE('./root');
        var shim = USE('./shim');
        USE('./settings');
        // Derive shared secret from other's pub and my epub/epriv 
        SEA.secret = SEA.secret || (async (key, pair, cb, opt) => { try {
          opt = opt || {};
          if(!pair || !pair.epriv || !pair.epub){
            if(!SEA.I){ throw 'No secret mix.' }
            pair = await SEA.I(null, {what: key, how: 'secret', why: opt.why});
          }
          var pub = key.epub || key;
          var epub = pair.epub;
          var epriv = pair.epriv;
          var ecdhSubtle = shim.ossl || shim.subtle;
          var pubKeyData = keysToEcdhJwk(pub);
          var props = Object.assign({ public: await ecdhSubtle.importKey(...pubKeyData, true, []) },{name: 'ECDH', namedCurve: 'P-256'}); // Thanks to @sirpy !
          var privKeyData = keysToEcdhJwk(epub, epriv);
          var derived = await ecdhSubtle.importKey(...privKeyData, false, ['deriveBits']).then(async (privKey) => {
            // privateKey scope doesn't leak out from here!
            var derivedBits = await ecdhSubtle.deriveBits(props, privKey, 256);
            var rawBits = new Uint8Array(derivedBits);
            var derivedKey = await ecdhSubtle.importKey('raw', rawBits,{ name: 'AES-GCM', length: 256 }, true, [ 'encrypt', 'decrypt' ]);
            return ecdhSubtle.exportKey('jwk', derivedKey).then(({ k }) => k);
          });
          var r = derived;
          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        } catch(e) {
          console.log(e);
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        // can this be replaced with settings.jwk?
        var keysToEcdhJwk = (pub, d) => { // d === priv
          //var [ x, y ] = shim.Buffer.from(pub, 'base64').toString('utf8').split(':') // old
          var [ x, y ] = pub.split('.'); // new
          var jwk = d ? { d: d } : {};
          return [  // Use with spread returned value...
            'jwk',
            Object.assign(
              jwk,
              { x: x, y: y, kty: 'EC', crv: 'P-256', ext: true }
            ), // ??? refactor
            {name: 'ECDH', namedCurve: 'P-256'}
          ]
        };

        module.exports = SEA.secret;
      })(USE, './secret');
    USE(function(module){
        var SEA = USE('./root');
        // This is to certify that a group of "certificants" can "put" anything at a group of matched "paths" to the certificate authority's graph
        SEA.certify = SEA.certify || (async (certificants, policy = {}, authority, cb, opt = {}) => { try {
          /*
          The Certify Protocol was made out of love by a Vietnamese code enthusiast. Vietnamese people around the world deserve respect!
          IMPORTANT: A Certificate is like a Signature. No one knows who (authority) created/signed a cert until you put it into their graph.
          "certificants": '*' or a String (Bob.pub) || an Object that contains "pub" as a key || an array of [object || string]. These people will have the rights.
          "policy": A string ('inbox'), or a RAD/LEX object {'*': 'inbox'}, or an Array of RAD/LEX objects or strings. RAD/LEX object can contain key "?" with indexOf("*") > -1 to force key equals certificant pub. This rule is used to check against soul+'/'+key using Gun.text.match or String.match.
          "authority": Key pair or priv of the certificate authority.
          "cb": A callback function after all things are done.
          "opt": If opt.expiry (a timestamp) is set, SEA won't sync data after opt.expiry. If opt.block is set, SEA will look for block before syncing.
          */
          console.log('SEA.certify() is an early experimental community supported method that may change API behavior without warning in any future version.');

          certificants = (() => {
            var data = [];
            if (certificants) {
              if ((typeof certificants === 'string' || Array.isArray(certificants)) && certificants.indexOf('*') > -1) return '*'
              if (typeof certificants === 'string') return certificants
              if (Array.isArray(certificants)) {
                if (certificants.length === 1 && certificants[0]) return typeof certificants[0] === 'object' && certificants[0].pub ? certificants[0].pub : typeof certificants[0] === 'string' ? certificants[0] : null
                certificants.map(certificant => {
                  if (typeof certificant ==='string') data.push(certificant);
                  else if (typeof certificant === 'object' && certificant.pub) data.push(certificant.pub);
                });
              }

              if (typeof certificants === 'object' && certificants.pub) return certificants.pub
              return data.length > 0 ? data : null
            }
            return
          })();

          if (!certificants) return console.log("No certificant found.")

          const expiry = opt.expiry && (typeof opt.expiry === 'number' || typeof opt.expiry === 'string') ? parseFloat(opt.expiry) : null;
          const readPolicy = (policy || {}).read ? policy.read : null;
          const writePolicy = (policy || {}).write ? policy.write : typeof policy === 'string' || Array.isArray(policy) || policy["+"] || policy["#"] || policy["."] || policy["="] || policy["*"] || policy[">"] || policy["<"] ? policy : null;
          // The "blacklist" feature is now renamed to "block". Why ? BECAUSE BLACK LIVES MATTER!
          // We can now use 3 keys: block, blacklist, ban
          const block = (opt || {}).block || (opt || {}).blacklist || (opt || {}).ban || {};
          const readBlock = block.read && (typeof block.read === 'string' || (block.read || {})['#']) ? block.read : null;
          const writeBlock = typeof block === 'string' ? block : block.write && (typeof block.write === 'string' || block.write['#']) ? block.write : null;

          if (!readPolicy && !writePolicy) return console.log("No policy found.")

          // reserved keys: c, e, r, w, rb, wb
          const data = JSON.stringify({
            c: certificants,
            ...(expiry ? {e: expiry} : {}), // inject expiry if possible
            ...(readPolicy ? {r: readPolicy }  : {}), // "r" stands for read, which means read permission.
            ...(writePolicy ? {w: writePolicy} : {}), // "w" stands for write, which means write permission.
            ...(readBlock ? {rb: readBlock} : {}), // inject READ block if possible
            ...(writeBlock ? {wb: writeBlock} : {}), // inject WRITE block if possible
          });

          const certificate = await SEA.sign(data, authority, null, {raw:1});

          var r = certificate;
          if(!opt.raw){ r = 'SEA'+JSON.stringify(r); }
          if(cb){ try{ cb(r); }catch(e){console.log(e);} }
          return r;
        } catch(e) {
          SEA.err = e;
          if(SEA.throw){ throw e }
          if(cb){ cb(); }
          return;
        }});

        module.exports = SEA.certify;
      })(USE, './certify');
    USE(function(module){
        var shim = USE('./shim');
        // Practical examples about usage found in tests.
        var SEA = USE('./root');
        SEA.work = USE('./work');
        SEA.sign = USE('./sign');
        SEA.verify = USE('./verify');
        SEA.encrypt = USE('./encrypt');
        SEA.decrypt = USE('./decrypt');
        SEA.certify = USE('./certify');
        //SEA.opt.aeskey = USE('./aeskey'); // not official! // this causes problems in latest WebCrypto.

        SEA.random = SEA.random || shim.random;

        // This is Buffer used in SEA and usable from Gun/SEA application also.
        // For documentation see https://nodejs.org/api/buffer.html
        SEA.Buffer = SEA.Buffer || USE('./buffer');

        // These SEA functions support now ony Promises or
        // async/await (compatible) code, use those like Promises.
        //
        // Creates a wrapper library around Web Crypto API
        // for various AES, ECDSA, PBKDF2 functions we called above.
        // Calculate public key KeyID aka PGPv4 (result: 8 bytes as hex string)
        SEA.keyid = SEA.keyid || (async (pub) => {
          try {
            // base64('base64(x):base64(y)') => shim.Buffer(xy)
            const pb = shim.Buffer.concat(
              pub.replace(/-/g, '+').replace(/_/g, '/').split('.')
              .map((t) => shim.Buffer.from(t, 'base64'))
            );
            // id is PGPv4 compliant raw key
            const id = shim.Buffer.concat([
              shim.Buffer.from([0x99, pb.length / 0x100, pb.length % 0x100]), pb
            ]);
            const sha1 = await sha1hash(id);
            const hash = shim.Buffer.from(sha1, 'binary');
            return hash.toString('hex', hash.length - 8)  // 16-bit ID as hex
          } catch (e) {
            console.log(e);
            throw e
          }
        });
        // all done!
        // Obviously it is missing MANY necessary features. This is only an alpha release.
        // Please experiment with it, audit what I've done so far, and complain about what needs to be added.
        // SEA should be a full suite that is easy and seamless to use.
        // Again, scroll naer the top, where I provide an EXAMPLE of how to create a user and sign in.
        // Once logged in, the rest of the code you just read handled automatically signing/validating data.
        // But all other behavior needs to be equally easy, like opinionated ways of
        // Adding friends (trusted public keys), sending private messages, etc.
        // Cheers! Tell me what you think.
        ((SEA.window||{}).GUN||{}).SEA = SEA;

        module.exports = SEA;
        // -------------- END SEA MODULES --------------------
        // -- BEGIN SEA+GUN MODULES: BUNDLED BY DEFAULT UNTIL OTHERS USE SEA ON OWN -------
      })(USE, './sea');
    USE(function(module){
        var SEA = USE('./sea'), Gun, u;
        if(SEA.window){
          Gun = SEA.window.GUN || {chain:{}};
        } else {
          Gun = USE((u+'' == typeof MODULE?'.':'')+'./gun', 1);
        }
        SEA.GUN = Gun;

        function User(root){ 
          this._ = {$: this};
        }
        User.prototype = (function(){ function F(){} F.prototype = Gun.chain; return new F() }()); // Object.create polyfill
        User.prototype.constructor = User;

        // let's extend the gun chain with a `user` function.
        // only one user can be logged in at a time, per gun instance.
        Gun.chain.user = function(pub){
          var gun = this, root = gun.back(-1), user;
          if(pub){
            pub = SEA.opt.pub((pub._||'')['#']) || pub;
            return root.get('~'+pub);
          }
          if(user = root.back('user')){ return user }
          var root = (root._), at = root, uuid = at.opt.uuid || lex;
          (at = (user = at.user = gun.chain(new User))._).opt = {};
          at.opt.uuid = function(cb){
            var id = uuid(), pub = root.user;
            if(!pub || !(pub = pub.is) || !(pub = pub.pub)){ return id }
            id = '~' + pub + '/' + id;
            if(cb && cb.call){ cb(null, id); }
            return id;
          };
          return user;
        };
        function lex(){ return Gun.state().toString(36).replace('.','') }
        Gun.User = User;
        User.GUN = Gun;
        User.SEA = Gun.SEA = SEA;
        module.exports = User;
      })(USE, './user');
    USE(function(module){
        var u, Gun = (''+u != typeof GUN)? (GUN||{chain:{}}) : USE((''+u === typeof MODULE?'.':'')+'./gun', 1);
        Gun.chain.then = function(cb, opt){
          var gun = this, p = (new Promise(function(res, rej){
            gun.once(res, opt);
          }));
          return cb? p.then(cb) : p;
        };
      })(USE, './then');
    USE(function(module){
        var User = USE('./user'), SEA = User.SEA, Gun = User.GUN, noop = function(){};

        // Well first we have to actually create a user. That is what this function does.
        User.prototype.create = function(...args){
          var pair = typeof args[0] === 'object' && (args[0].pub || args[0].epub) ? args[0] : typeof args[1] === 'object' && (args[1].pub || args[1].epub) ? args[1] : null;
          var alias = pair && (pair.pub || pair.epub) ? pair.pub : typeof args[0] === 'string' ? args[0] : null;
          var pass = pair && (pair.pub || pair.epub) ? pair : alias && typeof args[1] === 'string' ? args[1] : null;
          var cb = args.filter(arg => typeof arg === 'function')[0] || null; // cb now can stand anywhere, after alias/pass or pair
          var opt = args && args.length > 1 && typeof args[args.length-1] === 'object' ? args[args.length-1] : {}; // opt is always the last parameter which typeof === 'object' and stands after cb
          
          var gun = this, cat = (gun._), root = gun.back(-1);
          cb = cb || noop;
          opt = opt || {};
          if(false !== opt.check){
            var err;
            if(!alias){ err = "No user."; }
            if((pass||'').length < 8){ err = "Password too short!"; }
            if(err){
              cb({err: Gun.log(err)});
              return gun;
            }
          }
          if(cat.ing){
            (cb || noop)({err: Gun.log("User is already being created or authenticated!"), wait: true});
            return gun;
          }
          cat.ing = true;
          var act = {};
          act.a = function(pubs){
            act.pubs = pubs;
            if(pubs && !opt.already){
              // If we can enforce that a user name is already taken, it might be nice to try, but this is not guaranteed.
              var ack = {err: Gun.log('User already created!')};
              cat.ing = false;
              (cb || noop)(ack);
              gun.leave();
              return;
            }
            act.salt = String.random(64); // pseudo-randomly create a salt, then use PBKDF2 function to extend the password with it.
            SEA.work(pass, act.salt, act.b); // this will take some short amount of time to produce a proof, which slows brute force attacks.
          };
          act.b = function(proof){
            act.proof = proof;
            pair ? act.c(pair) : SEA.pair(act.c); // generate a brand new key pair or use the existing.
          };
          act.c = function(pair){
            var tmp;
            act.pair = pair || {};
            if(tmp = cat.root.user){
              tmp._.sea = pair;
              tmp.is = {pub: pair.pub, epub: pair.epub, alias: alias};
            }
            // the user's public key doesn't need to be signed. But everything else needs to be signed with it! // we have now automated it! clean up these extra steps now!
            act.data = {pub: pair.pub};
            act.d();
          };
          act.d = function(){
            act.data.alias = alias;
            act.e();
          };
          act.e = function(){
            act.data.epub = act.pair.epub; 
            SEA.encrypt({priv: act.pair.priv, epriv: act.pair.epriv}, act.proof, act.f, {raw:1}); // to keep the private key safe, we AES encrypt it with the proof of work!
          };
          act.f = function(auth){
            act.data.auth = JSON.stringify({ek: auth, s: act.salt}); 
            act.g(act.data.auth);
          };
          act.g = function(auth){ var tmp;
            act.data.auth = act.data.auth || auth;
            root.get(tmp = '~'+act.pair.pub).put(act.data).on(act.h); // awesome, now we can actually save the user with their public key as their ID.
            var link = {}; link[tmp] = {'#': tmp}; root.get('~@'+alias).put(link).get(tmp).on(act.i); // next up, we want to associate the alias with the public key. So we add it to the alias list.
          };
          act.h = function(data, key, msg, eve){
            eve.off(); act.h.ok = 1; act.i();
          };
          act.i = function(data, key, msg, eve){
            if(eve){ act.i.ok = 1; eve.off(); }
            if(!act.h.ok || !act.i.ok){ return }
            cat.ing = false;
            cb({ok: 0, pub: act.pair.pub}); // callback that the user has been created. (Note: ok = 0 because we didn't wait for disk to ack)
            if(noop === cb){ pair ? gun.auth(pair) : gun.auth(alias, pass); } // if no callback is passed, auto-login after signing up.
          };
          root.get('~@'+alias).once(act.a);
          return gun;
        };
        User.prototype.leave = function(opt, cb){
          var gun = this, user = (gun.back(-1)._).user;
          if(user){
            delete user.is;
            delete user._.is;
            delete user._.sea;
          }
          if(SEA.window){
            try{var sS = {};
            sS = SEA.window.sessionStorage;
            delete sS.recall;
            delete sS.pair;
            }catch(e){}      }
          return gun;
        };
      })(USE, './create');
    USE(function(module){
        var User = USE('./user'), SEA = User.SEA, Gun = User.GUN, noop = function(){};
        // now that we have created a user, we want to authenticate them!
        User.prototype.auth = function(...args){ // TODO: this PR with arguments need to be cleaned up / refactored.
          var pair = typeof args[0] === 'object' && (args[0].pub || args[0].epub) ? args[0] : typeof args[1] === 'object' && (args[1].pub || args[1].epub) ? args[1] : null;
          var alias = !pair && typeof args[0] === 'string' ? args[0] : null;
          var pass = (alias || (pair && !(pair.priv && pair.epriv))) && typeof args[1] === 'string' ? args[1] : null;
          var cb = args.filter(arg => typeof arg === 'function')[0] || null; // cb now can stand anywhere, after alias/pass or pair
          var opt = args && args.length > 1 && typeof args[args.length-1] === 'object' ? args[args.length-1] : {}; // opt is always the last parameter which typeof === 'object' and stands after cb
          
          var gun = this, cat = (gun._), root = gun.back(-1);
          
          if(cat.ing){
            (cb || noop)({err: Gun.log("User is already being created or authenticated!"), wait: true});
            return gun;
          }
          cat.ing = true;
          
          var act = {}, u, tries = 9;
          act.a = function(data){
            if(!data){ return act.b() }
            if(!data.pub){
              var tmp = []; Object.keys(data).forEach(function(k){ if('_'==k){ return } tmp.push(data[k]); });
              return act.b(tmp);
            }
            if(act.name){ return act.f(data) }
            act.c((act.data = data).auth);
          };
          act.b = function(list){
            var get = (act.list = (act.list||[]).concat(list||[])).shift();
            if(u === get){
              if(act.name){ return act.err('Your user account is not published for dApps to access, please consider syncing it online, or allowing local access by adding your device as a peer.') }
              if(alias && tries--){
                root.get('~@'+alias).once(act.a);
                return;
              }
              return act.err('Wrong user or password.') 
            }
            root.get(get).once(act.a);
          };
          act.c = function(auth){
            if(u === auth){ return act.b() }
            if('string' == typeof auth){ return act.c(obj_ify(auth)) } // in case of legacy
            SEA.work(pass, (act.auth = auth).s, act.d, act.enc); // the proof of work is evidence that we've spent some time/effort trying to log in, this slows brute force.
          };
          act.d = function(proof){
            SEA.decrypt(act.auth.ek, proof, act.e, act.enc);
          };
          act.e = function(half){
            if(u === half){
              if(!act.enc){ // try old format
                act.enc = {encode: 'utf8'};
                return act.c(act.auth);
              } act.enc = null; // end backwards
              return act.b();
            }
            act.half = half;
            act.f(act.data);
          };
          act.f = function(pair){
            var half = act.half || {}, data = act.data || {};
            act.g(act.lol = {pub: pair.pub || data.pub, epub: pair.epub || data.epub, priv: pair.priv || half.priv, epriv: pair.epriv || half.epriv});
          };
          act.g = function(pair){
            if(!pair || !pair.pub || !pair.epub){ return act.b() }
            act.pair = pair;
            var user = (root._).user, at = (user._);
            at.tag;
            var upt = at.opt;
            at = user._ = root.get('~'+pair.pub)._;
            at.opt = upt;
            // add our credentials in-memory only to our root user instance
            user.is = {pub: pair.pub, epub: pair.epub, alias: alias || pair.pub};
            at.sea = act.pair;
            cat.ing = false;
            try{if(pass && u == (obj_ify(cat.root.graph['~'+pair.pub].auth)||'')[':']){ opt.shuffle = opt.change = pass; } }catch(e){} // migrate UTF8 & Shuffle!
            opt.change? act.z() : (cb || noop)(at);
            if(SEA.window && ((gun.back('user')._).opt||opt).remember){
              // TODO: this needs to be modular.
              try{var sS = {};
              sS = SEA.window.sessionStorage; // TODO: FIX BUG putting on `.is`!
              sS.recall = true;
              sS.pair = JSON.stringify(pair); // auth using pair is more reliable than alias/pass
              }catch(e){}
            }
            try{
              if(root._.tag.auth){ // auth handle might not be registered yet
              (root._).on('auth', at); // TODO: Deprecate this, emit on user instead! Update docs when you do.
              } else { setTimeout(function(){ (root._).on('auth', at); },1); } // if not, hackily add a timeout.
              //at.on('auth', at) // Arrgh, this doesn't work without event "merge" code, but "merge" code causes stack overflow and crashes after logging in & trying to write data.
            }catch(e){
              Gun.log("Your 'auth' callback crashed with:", e);
            }
          };
          act.h = function(data){
            if(!data){ return act.b() }
            alias = data.alias;
            if(!alias)
              alias = data.alias = "~" + pair.pub;        
            if(!data.auth){
              return act.g(pair);
            }
            pair = null;
            act.c((act.data = data).auth);
          };
          act.z = function(){
            // password update so encrypt private key using new pwd + salt
            act.salt = String.random(64); // pseudo-random
            SEA.work(opt.change, act.salt, act.y);
          };
          act.y = function(proof){
            SEA.encrypt({priv: act.pair.priv, epriv: act.pair.epriv}, proof, act.x, {raw:1});
          };
          act.x = function(auth){
            act.w(JSON.stringify({ek: auth, s: act.salt}));
          };
          act.w = function(auth){
            if(opt.shuffle){ // delete in future!
              console.log('migrate core account from UTF8 & shuffle');
              var tmp = {}; Object.keys(act.data).forEach(function(k){ tmp[k] = act.data[k]; });
              delete tmp._;
              tmp.auth = auth;
              root.get('~'+act.pair.pub).put(tmp);
            } // end delete
            root.get('~'+act.pair.pub).get('auth').put(auth, cb || noop);
          };
          act.err = function(e){
            var ack = {err: Gun.log(e || 'User cannot be found!')};
            cat.ing = false;
            (cb || noop)(ack);
          };
          act.plugin = function(name){
            if(!(act.name = name)){ return act.err() }
            var tmp = [name];
            if('~' !== name[0]){
              tmp[1] = '~'+name;
              tmp[2] = '~@'+name;
            }
            act.b(tmp);
          };
          if(pair){
            if(pair.priv && pair.epriv)
              act.g(pair);
            else
              root.get('~'+pair.pub).once(act.h);
          } else
          if(alias){
            root.get('~@'+alias).once(act.a);
          } else
          if(!alias && !pass){
            SEA.name(act.plugin);
          }
          return gun;
        };
        function obj_ify(o){
          if('string' != typeof o){ return o }
          try{o = JSON.parse(o);
          }catch(e){o={};}      return o;
        }
      })(USE, './auth');
    USE(function(module){
        var User = USE('./user'), SEA = User.SEA; User.GUN;
        User.prototype.recall = function(opt, cb){
          var gun = this, root = gun.back(-1);
          opt = opt || {};
          if(opt && opt.sessionStorage){
            if(SEA.window){
              try{
                var sS = {};
                sS = SEA.window.sessionStorage; // TODO: FIX BUG putting on `.is`!
                if(sS){
                  (root._).opt.remember = true;
                  ((gun.back('user')._).opt||opt).remember = true;
                  if(sS.recall || sS.pair) root.user().auth(JSON.parse(sS.pair), cb); // pair is more reliable than alias/pass
                }
              }catch(e){}
            }
            return gun;
          }
          /*
            TODO: copy mhelander's expiry code back in.
            Although, we should check with community,
            should expiry be core or a plugin?
          */
          return gun;
        };
      })(USE, './recall');
    USE(function(module){
        var User = USE('./user'), SEA = User.SEA, Gun = User.GUN, noop = function(){};
        User.prototype.pair = function(){
          var user = this, proxy; // undeprecated, hiding with proxies.
          try{ proxy = new Proxy({DANGER:'\u2620'}, {get: function(t,p,r){
            if(!user.is || !(user._||'').sea){ return }
            return user._.sea[p];
          }});}catch(e){}
          return proxy;
        };
        // If authenticated user wants to delete his/her account, let's support it!
        User.prototype.delete = async function(alias, pass, cb){
          console.log("user.delete() IS DEPRECATED AND WILL BE MOVED TO A MODULE!!!");
          var gun = this; gun.back(-1); var user = gun.back('user');
          try {
            user.auth(alias, pass, function(ack){
              var pub = (user.is||{}).pub;
              // Delete user data
              user.map().once(function(){ this.put(null); });
              // Wipe user data from memory
              user.leave();
              (cb || noop)({ok: 0});
            });
          } catch (e) {
            Gun.log('User.delete failed! Error:', e);
          }
          return gun;
        };
        User.prototype.alive = async function(){
          console.log("user.alive() IS DEPRECATED!!!");
          const gunRoot = this.back(-1);
          try {
            // All is good. Should we do something more with actual recalled data?
            await authRecall(gunRoot);
            return gunRoot._.user._
          } catch (e) {
            const err = 'No session!';
            Gun.log(err);
            throw { err }
          }
        };
        User.prototype.trust = async function(user){
          console.log("`.trust` API MAY BE DELETED OR CHANGED OR RENAMED, DO NOT USE!");
          // TODO: BUG!!! SEA `node` read listener needs to be async, which means core needs to be async too.
          //gun.get('alice').get('age').trust(bob);
          if (Gun.is(user)) {
            user.get('pub').get((ctx, ev) => {
              console.log(ctx, ev);
            });
          }
          user.get('trust').get(path).put(theirPubkey);

          // do a lookup on this gun chain directly (that gets bob's copy of the data)
          // do a lookup on the metadata trust table for this path (that gets all the pubkeys allowed to write on this path)
          // do a lookup on each of those pubKeys ON the path (to get the collab data "layers")
          // THEN you perform Jachen's mix operation
          // and return the result of that to...
        };
        User.prototype.grant = function(to, cb){
          console.log("`.grant` API MAY BE DELETED OR CHANGED OR RENAMED, DO NOT USE!");
          var gun = this, user = gun.back(-1).user(), pair = user._.sea, path = '';
          gun.back(function(at){ if(at.is){ return } path += (at.get||''); });
          (async function(){
          var enc, sec = await user.get('grant').get(pair.pub).get(path).then();
          sec = await SEA.decrypt(sec, pair);
          if(!sec){
            sec = SEA.random(16).toString();
            enc = await SEA.encrypt(sec, pair);
            user.get('grant').get(pair.pub).get(path).put(enc);
          }
          var pub = to.get('pub').then();
          var epub = to.get('epub').then();
          pub = await pub; epub = await epub;
          var dh = await SEA.secret(epub, pair);
          enc = await SEA.encrypt(sec, dh);
          user.get('grant').get(pub).get(path).put(enc, cb);
          }());
          return gun;
        };
        User.prototype.secret = function(data, cb){
          console.log("`.secret` API MAY BE DELETED OR CHANGED OR RENAMED, DO NOT USE!");
          var gun = this, user = gun.back(-1).user(), pair = user.pair(), path = '';
          gun.back(function(at){ if(at.is){ return } path += (at.get||''); });
          (async function(){
          var enc, sec = await user.get('trust').get(pair.pub).get(path).then();
          sec = await SEA.decrypt(sec, pair);
          if(!sec){
            sec = SEA.random(16).toString();
            enc = await SEA.encrypt(sec, pair);
            user.get('trust').get(pair.pub).get(path).put(enc);
          }
          enc = await SEA.encrypt(data, sec);
          gun.put(enc, cb);
          }());
          return gun;
        };

        /**
         * returns the decrypted value, encrypted by secret
         * @returns {Promise<any>}
         // Mark needs to review 1st before officially supported
        User.prototype.decrypt = function(cb) {
          let gun = this,
            path = ''
          gun.back(function(at) {
            if (at.is) {
              return
            }
            path += at.get || ''
          })
          return gun
            .then(async data => {
              if (data == null) {
                return
              }
              const user = gun.back(-1).user()
              const pair = user.pair()
              let sec = await user
                .get('trust')
                .get(pair.pub)
                .get(path)
              sec = await SEA.decrypt(sec, pair)
              if (!sec) {
                return data
              }
              let decrypted = await SEA.decrypt(data, sec)
              return decrypted
            })
            .then(res => {
              cb && cb(res)
              return res
            })
        }
        */
        module.exports = User;
      })(USE, './share');
    USE(function(module){
        var SEA = USE('./sea'), S = USE('./settings'), u;
        var Gun = (SEA.window||'').GUN || USE((''+u === typeof MODULE?'.':'')+'./gun', 1);
        // After we have a GUN extension to make user registration/login easy, we then need to handle everything else.

        // We do this with a GUN adapter, we first listen to when a gun instance is created (and when its options change)
        Gun.on('opt', function(at){
          if(!at.sea){ // only add SEA once per instance, on the "at" context.
            at.sea = {own: {}};
            at.on('put', check, at); // SEA now runs its firewall on HAM diffs, not all i/o.
          }
          this.to.next(at); // make sure to call the "next" middleware adapter.
        });

        // Alright, this next adapter gets run at the per node level in the graph database.
        // correction: 2020 it gets run on each key/value pair in a node upon a HAM diff.
        // This will let us verify that every property on a node has a value signed by a public key we trust.
        // If the signature does not match, the data is just `undefined` so it doesn't get passed on.
        // If it does match, then we transform the in-memory "view" of the data into its plain value (without the signature).
        // Now NOTE! Some data is "system" data, not user data. Example: List of public keys, aliases, etc.
        // This data is self-enforced (the value can only match its ID), but that is handled in the `security` function.
        // From the self-enforced data, we can see all the edges in the graph that belong to a public key.
        // Example: ~ASDF is the ID of a node with ASDF as its public key, signed alias and salt, and
        // its encrypted private key, but it might also have other signed values on it like `profile = <ID>` edge.
        // Using that directed edge's ID, we can then track (in memory) which IDs belong to which keys.
        // Here is a problem: Multiple public keys can "claim" any node's ID, so this is dangerous!
        // This means we should ONLY trust our "friends" (our key ring) public keys, not any ones.
        // I have not yet added that to SEA yet in this alpha release. That is coming soon, but beware in the meanwhile!

        function check(msg){ // REVISE / IMPROVE, NO NEED TO PASS MSG/EVE EACH SUB?
          var eve = this, at = eve.as, put = msg.put, soul = put['#'], key = put['.'], val = put[':'], state = put['>'], id = msg['#'], tmp;
          if(!soul || !key){ return }
          if((msg._||'').faith && (at.opt||'').faith && 'function' == typeof msg._){
            SEA.opt.pack(put, function(raw){
            SEA.verify(raw, false, function(data){ // this is synchronous if false
              put['='] = SEA.opt.unpack(data);
              eve.to.next(msg);
            });});
            return 
          }
          var no = function(why){ at.on('in', {'@': id, err: msg.err = why}); }; // exploit internal relay stun for now, maybe violates spec, but testing for now. // Note: this may be only the sharded message, not original batch.
          //var no = function(why){ msg.ack(why) };
          (msg._||'').DBG && ((msg._||'').DBG.c = +new Date);
          if(0 <= soul.indexOf('<?')){ // special case for "do not sync data X old" forget
            // 'a~pub.key/b<?9'
            tmp = parseFloat(soul.split('<?')[1]||'');
            if(tmp && (state < (Gun.state() - (tmp * 1000)))){ // sec to ms
              (tmp = msg._) && (tmp.stun) && (tmp.stun--); // THIS IS BAD CODE! It assumes GUN internals do something that will probably change in future, but hacking in now.
              return; // omit!
            }
          }
          
          if('~@' === soul){  // special case for shared system data, the list of aliases.
            check.alias(eve, msg, val, key, soul, at, no); return;
          }
          if('~@' === soul.slice(0,2)){ // special case for shared system data, the list of public keys for an alias.
            check.pubs(eve, msg, val, key, soul, at, no); return;
          }
          //if('~' === soul.slice(0,1) && 2 === (tmp = soul.slice(1)).split('.').length){ // special case, account data for a public key.
          if(tmp = SEA.opt.pub(soul)){ // special case, account data for a public key.
            check.pub(eve, msg, val, key, soul, at, no, at.user||'', tmp); return;
          }
          if(0 <= soul.indexOf('#')){ // special case for content addressing immutable hashed data.
            check.hash(eve, msg, val, key, soul, at, no); return;
          } 
          check.any(eve, msg, val, key, soul, at, no, at.user||''); return;
        }
        check.hash = function(eve, msg, val, key, soul, at, no){ // mark unbuilt @i001962 's epic hex contrib!
          SEA.work(val, null, function(data){
            function hexToBase64(hexStr) {
              let base64 = "";
              for(let i = 0; i < hexStr.length; i++) {
                base64 += !(i - 1 & 1) ? String.fromCharCode(parseInt(hexStr.substring(i - 1, i + 1), 16)) : "";}
              return btoa(base64);}  
            if(data && data === key.split('#').slice(-1)[0]){ return eve.to.next(msg) }
              else if (data && data === hexToBase64(key.split('#').slice(-1)[0])){ 
              return eve.to.next(msg) }
            no("Data hash not same as hash!");
          }, {name: 'SHA-256'});
        };
        check.alias = function(eve, msg, val, key, soul, at, no){ // Example: {_:#~@, ~@alice: {#~@alice}}
          if(!val){ return no("Data must exist!") } // data MUST exist
          if('~@'+key === link_is(val)){ return eve.to.next(msg) } // in fact, it must be EXACTLY equal to itself
          no("Alias not same!"); // if it isn't, reject.
        };
        check.pubs = function(eve, msg, val, key, soul, at, no){ // Example: {_:#~@alice, ~asdf: {#~asdf}}
          if(!val){ return no("Alias must exist!") } // data MUST exist
          if(key === link_is(val)){ return eve.to.next(msg) } // and the ID must be EXACTLY equal to its property
          no("Alias not same!"); // that way nobody can tamper with the list of public keys.
        };
        check.pub = async function(eve, msg, val, key, soul, at, no, user, pub){ var tmp; // Example: {_:#~asdf, hello:'world'~fdsa}}
          const raw = await S.parse(val) || {};
          const verify = (certificate, certificant, cb) => {
            if (certificate.m && certificate.s && certificant && pub)
              // now verify certificate
              return SEA.verify(certificate, pub, data => { // check if "pub" (of the graph owner) really issued this cert
                if (u !== data && u !== data.e && msg.put['>'] && msg.put['>'] > parseFloat(data.e)) return no("Certificate expired.") // certificate expired
                // "data.c" = a list of certificants/certified users
                // "data.w" = lex WRITE permission, in the future, there will be "data.r" which means lex READ permission
                if (u !== data && data.c && data.w && (data.c === certificant || data.c.indexOf('*' ) > -1)) {
                  // ok, now "certificant" is in the "certificants" list, but is "path" allowed? Check path
                  let path = soul.indexOf('/') > -1 ? soul.replace(soul.substring(0, soul.indexOf('/') + 1), '') : '';
                  String.match = String.match || Gun.text.match;
                  const w = Array.isArray(data.w) ? data.w : typeof data.w === 'object' || typeof data.w === 'string' ? [data.w] : [];
                  for (const lex of w) {
                    if ((String.match(path, lex['#']) && String.match(key, lex['.'])) || (!lex['.'] && String.match(path, lex['#'])) || (!lex['#'] && String.match(key, lex['.'])) || String.match((path ? path + '/' + key : key), lex['#'] || lex)) {
                      // is Certificant forced to present in Path
                      if (lex['+'] && lex['+'].indexOf('*') > -1 && path && path.indexOf(certificant) == -1 && key.indexOf(certificant) == -1) return no(`Path "${path}" or key "${key}" must contain string "${certificant}".`)
                      // path is allowed, but is there any WRITE block? Check it out
                      if (data.wb && (typeof data.wb === 'string' || ((data.wb || {})['#']))) { // "data.wb" = path to the WRITE block
                        var root = eve.as.root.$.back(-1);
                        if (typeof data.wb === 'string' && '~' !== data.wb.slice(0, 1)) root = root.get('~' + pub);
                        return root.get(data.wb).get(certificant).once(value => { // TODO: INTENT TO DEPRECATE.
                          if (value && (value === 1 || value === true)) return no(`Certificant ${certificant} blocked.`)
                          return cb(data)
                        })
                      }
                      return cb(data)
                    }
                  }
                  return no("Certificate verification fail.")
                }
              })
            return
          };
          
          if ('pub' === key && '~' + pub === soul) {
            if (val === pub) return eve.to.next(msg) // the account MUST match `pub` property that equals the ID of the public key.
            return no("Account not same!")
          }

          if ((tmp = user.is) && tmp.pub && !raw['*'] && !raw['+'] && (pub === tmp.pub || (pub !== tmp.pub && ((msg._.msg || {}).opt || {}).cert))){
            SEA.opt.pack(msg.put, packed => {
              SEA.sign(packed, (user._).sea, async function(data) {
                if (u === data) return no(SEA.err || 'Signature fail.')
                msg.put[':'] = {':': tmp = SEA.opt.unpack(data.m), '~': data.s};
                msg.put['='] = tmp;
      
                // if writing to own graph, just allow it
                if (pub === user.is.pub) {
                  if (tmp = link_is(val)) (at.sea.own[tmp] = at.sea.own[tmp] || {})[pub] = 1;
                  JSON.stringifyAsync(msg.put[':'], function(err,s){
                    if(err){ return no(err || "Stringify error.") }
                    msg.put[':'] = s;
                    return eve.to.next(msg);
                  });
                  return
                }
      
                // if writing to other's graph, check if cert exists then try to inject cert into put, also inject self pub so that everyone can verify the put
                if (pub !== user.is.pub && ((msg._.msg || {}).opt || {}).cert) {
                  const cert = await S.parse(msg._.msg.opt.cert);
                  // even if cert exists, we must verify it
                  if (cert && cert.m && cert.s)
                    verify(cert, user.is.pub, _ => {
                      msg.put[':']['+'] = cert; // '+' is a certificate
                      msg.put[':']['*'] = user.is.pub; // '*' is pub of the user who puts
                      JSON.stringifyAsync(msg.put[':'], function(err,s){
                        if(err){ return no(err || "Stringify error.") }
                        msg.put[':'] = s;
                        return eve.to.next(msg);
                      });
                      return
                    });
                }
              }, {raw: 1});
            });
            return;
          }

          SEA.opt.pack(msg.put, packed => {
            SEA.verify(packed, raw['*'] || pub, function(data){ var tmp;
              data = SEA.opt.unpack(data);
              if (u === data) return no("Unverified data.") // make sure the signature matches the account it claims to be on. // reject any updates that are signed with a mismatched account.
              if ((tmp = link_is(data)) && pub === SEA.opt.pub(tmp)) (at.sea.own[tmp] = at.sea.own[tmp] || {})[pub] = 1;
              
              // check if cert ('+') and putter's pub ('*') exist
              if (raw['+'] && raw['+']['m'] && raw['+']['s'] && raw['*'])
                // now verify certificate
                verify(raw['+'], raw['*'], _ => {
                  msg.put['='] = data;
                  return eve.to.next(msg);
                });
              else {
                msg.put['='] = data;
                return eve.to.next(msg);
              }
            });
          });
          return
        };
        check.any = function(eve, msg, val, key, soul, at, no, user){      if(at.opt.secure){ return no("Soul missing public key at '" + key + "'.") }
          // TODO: Ask community if should auto-sign non user-graph data.
          at.on('secure', function(msg){ this.off();
            if(!at.opt.secure){ return eve.to.next(msg) }
            no("Data cannot be changed.");
          }).on.on('secure', msg);
          return;
        };

        var valid = Gun.valid, link_is = function(d,l){ return 'string' == typeof (l = valid(d)) && l }; (Gun.state||'').ify;

        var pubcut = /[^\w_-]/; // anything not alphanumeric or _ -
        SEA.opt.pub = function(s){
          if(!s){ return }
          s = s.split('~');
          if(!s || !(s = s[1])){ return }
          s = s.split(pubcut).slice(0,2);
          if(!s || 2 != s.length){ return }
          if('@' === (s[0]||'')[0]){ return }
          s = s.slice(0,2).join('.');
          return s;
        };
        SEA.opt.stringy = function(t){
          // TODO: encrypt etc. need to check string primitive. Make as breaking change.
        };
        SEA.opt.pack = function(d,cb,k, n,s){ var tmp, f; // pack for verifying
          if(SEA.opt.check(d)){ return cb(d) }
          if(d && d['#'] && d['.'] && d['>']){ tmp = d[':']; f = 1; }
          JSON.parseAsync(f? tmp : d, function(err, meta){
            var sig = ((u !== (meta||'')[':']) && (meta||'')['~']); // or just ~ check?
            if(!sig){ cb(d); return }
            cb({m: {'#':s||d['#'],'.':k||d['.'],':':(meta||'')[':'],'>':d['>']||Gun.state.is(n, k)}, s: sig});
          });
        };
        var O = SEA.opt;
        SEA.opt.unpack = function(d, k, n){ var tmp;
          if(u === d){ return }
          if(d && (u !== (tmp = d[':']))){ return tmp }
          k = k || O.fall_key; if(!n && O.fall_val){ n = {}; n[k] = O.fall_val; }
          if(!k || !n){ return }
          if(d === n[k]){ return d }
          if(!SEA.opt.check(n[k])){ return d }
          var soul = (n && n._ && n._['#']) || O.fall_soul, s = Gun.state.is(n, k) || O.fall_state;
          if(d && 4 === d.length && soul === d[0] && k === d[1] && fl(s) === fl(d[3])){
            return d[2];
          }
          if(s < SEA.opt.shuffle_attack){
            return d;
          }
        };
        SEA.opt.shuffle_attack = 1546329600000; // Jan 1, 2019
        var fl = Math.floor; // TODO: Still need to fix inconsistent state issue.
        // TODO: Potential bug? If pub/priv key starts with `-`? IDK how possible.

      })(USE, './index');
    }());
    });

    // I don't quite know where this should go yet, so putting it here
    // what will probably wind up happening is that minimal AXE logic added to end of gun.js
    // and then rest of AXE logic (here) will be moved back to gun/axe.js
    // but for now... I gotta rush this out!
    var Gun$1 = (typeof window !== "undefined")? window.Gun : gun, u;
    Gun$1.on('opt', function(at){ start(at); this.to.next(at); }); // make sure to call the "next" middleware adapter.
    // TODO: BUG: panic test/panic/1 & test/panic/3 fail when AXE is on.
    function start(root){
    	if(root.axe){ return }
    	var opt = root.opt; opt.peers;
    	if(false === opt.axe){ return }
    	if((typeof process !== "undefined") && 'false' === ''+(process.env||'').AXE){ return }
    	Gun$1.log.once("AXE", "AXE relay enabled!");
    	var axe = root.axe = {};
    	var mesh = opt.mesh = opt.mesh || Gun$1.Mesh(root); // DAM!
    	var dup = root.dup;

    	mesh.way = function(msg){
    		if(!msg){ return }
    		//relayUp(msg); // TEMPORARY!!!
    		if(msg.get){ return GET(msg) }
    		if(msg.put){ return }
    		fall(msg);
    	};

    	function GET(msg){
    		if(!msg){ return }
    		var via = (msg._||'').via, ref;
    		if(!via || !via.id){ return fall(msg) }
    		// SUBSCRIPTION LOGIC MOVED TO GET'S ACK REPLY.
    		if(!(ref = REF(msg)._)){ return fall(msg) }
    		ref.asked = +new Date;
    		GET.turn(msg, ref.route, 0);
    	}
    	GET.turn = function(msg, route, turn){
    		var tmp = msg['#'], tag = dup.s[tmp], next; 
    		if(!tmp || !tag){ return } // message timed out, GUN may require us to relay, tho AXE does not like that. Rethink?
    		// TOOD: BUG! Handle edge case where live updates occur while these turn hashes are being checked (they'll never be consistent), but we don't want to degrade to O(N), if we know the via asking peer got an update, then we should do something like cancel these turns asking for data.
    		// Ideas: Save a random seed that sorts the route, store it and the index. // Or indexing on lowest latency is probably better.
    		clearTimeout(tag.lack);
    		if(tag.ack && (tmp = tag['##']) && msg['##'] === tmp){ return } // hashes match, stop asking other peers!
    		next = (Object.maps(route||opt.peers)).slice(turn = turn || 0);
    		if(!next.length){
    			if(!route){ return } // asked all peers, stop asking!
    			GET.turn(msg, u, 0); // asked all subs, now now ask any peers. (not always the best idea, but stays )
    			return;
    		}
    		setTimeout.each(next, function(id){
    			var peer = opt.peers[id]; turn++;
    			if(!peer || !peer.wire){ route && route.delete(id); return } // bye! // TODO: CHECK IF 0 OTHER PEERS & UNSUBSCRIBE
    			if(mesh.say(msg, peer) === false){ return } // was self
    			if(0 == (turn % 3)){ return 1 }
    		}, function(){
    			tag['##'] = msg['##']; // should probably set this in a more clever manner, do live `in` checks ++ --, etc. but being lazy for now. // TODO: Yes, see `in` TODO, currently this might match against only in-mem cause no other peers reply, which is "fine", but could cause a false positive.
    			tag.lack = setTimeout(function(){ GET.turn(msg, route, turn); }, 25);
    		}, 3);
    	};
    	function fall(msg){ mesh.say(msg, opt.peers); }
    	function REF(msg){
    		var ref = '', soul, has, tmp;
    		if(!msg || !msg.get){ return ref }
    		if('string' == typeof (soul = msg.get['#'])){ ref = root.$.get(soul); }
    		if('string' == typeof (tmp = msg.get['.'])){ has = tmp; } else { has = ''; }

    		var via = (msg._||'').via, sub = (via.sub || (via.sub = new Object.Map)); (sub.get(soul) || (sub.set(soul, tmp = new Object.Map) && tmp)).set(has, 1); // {soul: {'':1, has: 1}} // TEMPORARILY REVERT AXE TOWER TYING TO SUBSCRIBING TO EVERYTHING. UNDO THIS!
    		via.id && ref._ && (ref._.route || (ref._.route = new Object.Map)).set(via.id, via); // SAME AS ^

    		return ref;
    	}
    	function LEX(lex){ return (lex = lex || '')['='] || lex['*'] || lex['>'] || lex }
    	
    	root.on('in', function(msg){ var to = this.to, tmp;
    		if((tmp = msg['@']) && (tmp = dup.s[tmp])){
    			tmp.ack = (tmp.ack || 0) + 1; // count remote ACKs to GET. // TODO: If mismatch, should trigger next asks.
    			if(tmp.it && tmp.it.get && msg.put){ // WHEN SEEING A PUT REPLY TO A GET...
    				var get = tmp.it.get||'', ref = REF(tmp.it)._, via = (tmp.it._||'').via||'', sub;
    				if(via && ref){ // SUBSCRIBE THE PEER WHO ASKED VIA FOR IT:
    					//console.log("SUBSCRIBING", Object.maps(ref.route||''), "to", LEX(get['#']));
    					via.id && (ref.route || (ref.route = new Object.Map)).set(via.id, via);
    					sub = (via.sub || (via.sub = new Object.Map));
    					ref && (sub.get(LEX(get['#'])) || (sub.set(LEX(get['#']), sub = new Object.Map) && sub)).set(LEX(get['.']), 1); // {soul: {'':1, has: 1}}

    					via = (msg._||'').via||'';
    					if(via){ // BIDIRECTIONAL SUBSCRIBE: REPLIER IS NOW SUBSCRIBED. DO WE WANT THIS?
    						via.id && (ref.route || (ref.route = new Object.Map)).set(via.id, via);
    						sub = (via.sub || (via.sub = new Object.Map));
    						if(ref){
    							var soul = LEX(get['#']), sift = sub.get(soul), has = LEX(get['.']);
    							if(has){
    								(sift || (sub.set(soul, sift = new Object.Map) && sift)).set(has, 1);
    							} else
    							if(!sift){
    								sub.set(soul, sift = new Object.Map);
    								sift.set('', 1);
    							}
    						}
    					}
    				}
    			}
    			if((tmp = tmp.back)){ // backtrack OKs since AXE splits PUTs up.
    				setTimeout.each(Object.keys(tmp), function(id){
    					to.next({'#': msg['#'], '@': id, ok: msg.ok});
    				});
    				return;
    			}
    		}
    		to.next(msg);
    	});

    	root.on('create', function(root){
    		this.to.next(root);
    		root.on('put', function(msg){
    			var eve = this; eve.as; var put = msg.put, soul = put['#'], has = put['.'], val = put[':'], state = put['>'];
    			eve.to.next(msg);
    			if(msg['@']){ return } // acks send existing data, not updates, so no need to resend to others.
    			if(!soul || !has){ return }
    			var ref = root.$.get(soul)._, route = (ref||'').route;
    			if(!route){ return }
    			if(ref.skip && ref.skip.has == has){ ref.skip.now = msg['#']; return }
    			(ref.skip = {now: msg['#'], has: has}).to = setTimeout(function(){
    			setTimeout.each(Object.maps(route), function(pid){ var peer, tmp;
    				var skip = ref.skip||''; ref.skip = null;
    				if(!(peer = route.get(pid))){ return }
    				if(!peer.wire){ route.delete(pid); return } // bye!
    				var sub = (peer.sub || (peer.sub = new Object.Map)).get(soul);
    				if(!sub){ return }
    				if(!sub.get(has) && !sub.get('')){ return }
    				var put = peer.put || (peer.put = {});
    				var node = root.graph[soul], tmp;
    				if(node && u !== (tmp = node[has])){
    					state = state_is(node, has);
    					val = tmp;
    				}
    				put[soul] = state_ify(put[soul], has, state, val, soul);
    				tmp = dup.track(peer.next = peer.next || String.random(9));
    				(tmp.back || (tmp.back = {}))[''+(skip.now||msg['#'])] = 1;
    				if(peer.to){ return }
    				peer.to = setTimeout(function(){ flush(peer); }, opt.gap);
    			}); }, 9);
    		});
    	});

    	function flush(peer){
    		var msg = {'#': peer.next, put: peer.put, ok: {'@': 3, '/': mesh.near}}; // BUG: TODO: sub count!
    		// TODO: what about DAM's >< dedup? Current thinking is, don't use it, however, you could store first msg# & latest msg#, and if here... latest === first then likely it is the same >< thing, so if(firstMsg['><'][peer.id]){ return } don't send.
    		peer.next = peer.put = peer.to = null;
    		mesh.say(msg, peer);
    	}
    	var state_ify = Gun$1.state.ify, state_is = Gun$1.state.is;
    (function(){ // THIS IS THE UP MODULE;
    		axe.up = {};
    		var hi = mesh.hear['?']; // lower-level integration with DAM! This is abnormal but helps performance.
    		mesh.hear['?'] = function(msg, peer){ var p; // deduplicate unnecessary connections:
    			hi(msg, peer);
    			if(!peer.pid){ return }
    			if(peer.pid === opt.pid){ mesh.bye(peer); return } // if I connected to myself, drop.
    			if(p = axe.up[peer.pid]){ // if we both connected to each other...
    				if(p === peer){ return } // do nothing if no conflict,
    				if(opt.pid > peer.pid){ // else deterministically sort
    					p = peer; // so we will wind up choosing the same to keep
    					peer = axe.up[p.pid]; // and the same to drop.
    				}
    				p.url = p.url || peer.url; // copy if not
    				mesh.bye(peer); // drop
    				axe.up[p.pid] = p; // update same to be same.
    				return;
    			}
    			if(!peer.url){ return }
    			axe.up[peer.pid] = peer;
    			if(axe.stay){ axe.stay(); }
    		};

    		mesh.hear['opt'] = function(msg, peer){
    			if(msg.ok){ return }
    			var tmp = msg.opt;
    			if(!tmp){ return }
    			tmp = tmp.peers;
    			if(!tmp || 'string' != typeof tmp){ return }
    			if(99 <= Object.keys(axe.up).length){ return } // 99 TEMPORARILY UNTIL BENCHMARKED!
    			mesh.hi({id: tmp, url: tmp, retry: 9});
    			if(peer){ mesh.say({dam: 'opt', ok: 1, '@': msg['#']}, peer); }
    		};

    		axe.stay = function(){
    			clearTimeout(axe.stay.to);
    			axe.stay.to = setTimeout(function(tmp, urls){
    				if(!(tmp = root.stats && root.stats.stay)){ return }
    				urls = {}; Object.keys(axe.up||'').forEach(function(p){
    					p = (axe.up||'')[p]; if(p.url){ urls[p.url] = {}; }
    				});
    				(tmp.axe = tmp.axe || {}).up = urls;
    			}, 1000 * 9);//1000 * 60);
    		};
    		setTimeout(function(tmp){
    			if(!(tmp = root.stats && root.stats.stay && root.stats.stay.axe)){ return }
    			if(!(tmp = tmp.up)){ return }
    			if(!(tmp instanceof Array)){ tmp = Object.keys(tmp); }
    			setTimeout.each(tmp||[], function(url){ mesh.hear.opt({opt: {peers: url}}); });
    		},1000);
    	}());
    (function(){ // THIS IS THE MOB MODULE;
    		//return; // WORK IN PROGRESS, TEST FINALIZED, NEED TO MAKE STABLE.
    		/*
    			AXE should have a couple of threshold items...
    			let's pretend there is a variable max peers connected
    			mob = 10000
    			if we get more peers than that...
    			we should start sending those peers a remote command
    			that they should connect to this or that other peer
    			and then once they (or before they do?) drop them from us.
    			sake of the test... gonna set that peer number to 1.
    			The mob threshold might be determined by other factors,
    			like how much RAM or CPU stress we have.
    		*/
    		opt.mob = opt.mob || 9900; // should be based on ulimit, some clouds as low as 10K.

    		// handle rebalancing a mob of peers:
    		root.on('hi', function(peer){
    			this.to.next(peer);
    			if(peer.url){ return } // I am assuming that if we are wanting to make an outbound connection to them, that we don't ever want to drop them unless our actual config settings change.
    			var count = /*Object.keys(opt.peers).length ||*/ mesh.near; // TODO: BUG! This is slow, use .near, but near is buggy right now, fix in DAM.
    			//console.log("are we mobbed?", opt.mob, Object.keys(opt.peers).length, mesh.near);
    			if(opt.mob >= count){ return }  // TODO: Make dynamic based on RAM/CPU also. Or possibly even weird stuff like opt.mob / axe.up length?
    			var peers = {};Object.keys(axe.up).forEach(function(p){ p = axe.up[p]; p.url && (peers[p.url]={}); });
    			// TODO: BUG!!! Infinite reconnection loop happens if not enough relays, or if some are missing. For instance, :8766 says to connect to :8767 which then says to connect to :8766. To not DDoS when system overload, figure clever way to tell peers to retry later, that network does not have enough capacity?
    			mesh.say({dam: 'mob', mob: count, peers: peers}, peer);
    			setTimeout(function(){ mesh.bye(peer); }, 9); // something with better perf?
    		});
    		root.on('bye', function(peer){
    			this.to.next(peer);
    		});

    	}());
    }
    (function(){
    	var from = Array.from;
    	Object.maps = function(o){
    		if(from && o instanceof Map){ return from(o.keys()) }
    		if(o instanceof Object.Map){ o = o.s; }
    		return Object.keys(o);
    	};
    	if(from){ return Object.Map = Map }
    	(Object.Map = function(){ this.s = {}; }).prototype = {set:function(k,v){this.s[k]=v;return this},get:function(k){return this.s[k]},delete:function(k){delete this.s[k];}};
    }());

    createCommonjsModule(function (module) {
    (function(){

    	var sT = setTimeout || {}, u;
      if(typeof window !== ''+u){ sT.window = window; }
    	var AXE = (sT.window||'').AXE || function(){};
      if(AXE.window = sT.window){ AXE.window.AXE = AXE; }

    	var Gun = (AXE.window||'').GUN || gun;
    	(Gun.AXE = AXE).GUN = AXE.Gun = Gun;

      //if(!Gun.window){ try{ require('./lib/axe') }catch(e){} }
      if(!Gun.window);

    	Gun.on('opt', function(at){ start(at) ; this.to.next(at); }); // make sure to call the "next" middleware adapter.

    	function start(root){
    		if(root.axe){ return }
    		var opt = root.opt, peers = opt.peers;
    		if(false === opt.axe){ return }
    		if(!Gun.window){ return } // handled by ^ lib/axe.js
    		var w = Gun.window, lS = w.localStorage || opt.localStorage || {}, loc = w.location || opt.location || {}, nav = w.navigator || opt.navigator || {};
    		var axe = root.axe = {}, tmp, id;
    		var mesh = opt.mesh = opt.mesh || Gun.Mesh(root); // DAM!

    		tmp = peers[id = loc.origin + '/gun'] = peers[id] || {};
    		tmp.id = tmp.url = id; tmp.retry = tmp.retry || 0;
    		tmp = peers[id = 'http://localhost:8765/gun'] = peers[id] || {};
    		tmp.id = tmp.url = id; tmp.retry = tmp.retry || 0;
    		Gun.log.once("AXE", "AXE enabled: Trying to find network via (1) local peer (2) last used peers (3) a URL parameter, and last (4) hard coded peers.");
    		Gun.log.once("AXEWarn", "Warning: AXE is in alpha, use only for testing!");
    		var last = lS.peers || ''; if(last){ last += ' '; }
    		last += ((loc.search||'').split('peers=')[1]||'').split('&')[0];

    		root.on('bye', function(peer){
    			this.to.next(peer);
    			if(!peer.url){ return } // ignore WebRTC disconnects for now.
    			if(!nav.onLine){ peer.retry = 1; }
    			if(peer.retry){ return }
    			if(axe.fall){ delete axe.fall[peer.url || peer.id]; }
    			(function next(){
    				if(!axe.fall){ setTimeout(next, 9); return } // not found yet
    				var fall = Object.keys(axe.fall||''), one = fall[(Math.random()*fall.length) >> 0];
    				if(!fall.length){ lS.peers = ''; one = 'https://gunjs.herokuapp.com/gun'; } // out of peers
    				if(peers[one]){ next(); return } // already choose
    				mesh.hi(one);
    			}());
    		});

    		root.on('hi', function(peer){ // TEMPORARY! Try to connect all peers.
    			this.to.next(peer);
    			if(!peer.url){ return } // ignore WebRTC disconnects for now.
    			return; // DO NOT COMMIT THIS FEATURE YET! KEEP TESTING NETWORK PERFORMANCE FIRST!
    		});

    		function found(text){

    			axe.fall = {};
    			((text||'').match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/ig)||[]).forEach(function(url){
    				axe.fall[url] = {url: url, id: url, retry: 0}; // RETRY
    			});
    			
    			return;
    		}

    		if(last){ found(last); return }
    		try{ fetch(((loc.search||'').split('axe=')[1]||'').split('&')[0] || loc.axe || 'https://raw.githubusercontent.com/wiki/amark/gun/volunteer.dht.md').then(function(res){
    	  	return res.text()
    	  }).then(function(text){
    	  	found(lS.peers = text);
    	  }).catch(function(){
    	  	found(); // nothing
    	  });}catch(e){found();}
    	}
      try{ if('object' != ''+u){ module.exports = AXE; } }catch(e){}
    }());
    });

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    // Database
    const db = browser();

    // Gun User
    const user = db.user().recall({sessionStorage: true});

    // Current User's username
    const username = writable('');

    user.get('alias').on(v => username.set(v));

    db.on('auth', async(event) => {
        const alias = await user.get('alias'); // username string
        username.set(alias);

        console.log(`signed in as ${alias}`);
    });

    /* src\Login.svelte generated by Svelte v3.58.0 */
    const file$4 = "src\\Login.svelte";

    function create_fragment$4(ctx) {
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let button0;
    	let t7;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			label0 = element("label");
    			label0.textContent = "Username";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			label1 = element("label");
    			label1.textContent = "Password";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "Login";
    			t7 = space();
    			button1 = element("button");
    			button1.textContent = "Sign Up";
    			attr_dev(label0, "for", "username");
    			add_location(label0, file$4, 21, 0, 342);
    			attr_dev(input0, "name", "username");
    			attr_dev(input0, "minlength", "3");
    			attr_dev(input0, "maxlength", "16");
    			add_location(input0, file$4, 22, 0, 381);
    			attr_dev(label1, "for", "password");
    			add_location(label1, file$4, 24, 0, 459);
    			attr_dev(input1, "name", "password");
    			attr_dev(input1, "type", "password");
    			add_location(input1, file$4, 25, 0, 498);
    			attr_dev(button0, "class", "login");
    			add_location(button0, file$4, 27, 0, 563);
    			attr_dev(button1, "class", "login");
    			add_location(button1, file$4, 28, 0, 617);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, input0, anchor);
    			set_input_value(input0, /*username*/ ctx[0]);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, label1, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, input1, anchor);
    			set_input_value(input1, /*password*/ ctx[1]);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[5]),
    					listen_dev(button0, "click", /*login*/ ctx[2], false, false, false, false),
    					listen_dev(button1, "click", /*signup*/ ctx[3], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*username*/ 1 && input0.value !== /*username*/ ctx[0]) {
    				set_input_value(input0, /*username*/ ctx[0]);
    			}

    			if (dirty & /*password*/ 2 && input1.value !== /*password*/ ctx[1]) {
    				set_input_value(input1, /*password*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(input0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(label1);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(input1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Login', slots, []);
    	let username;
    	let password;

    	function login() {
    		user.auth(username, password, ({ err }) => err && alert(err));
    	}

    	function signup() {
    		user.create(username, password, ({ err }) => {
    			if (err) {
    				alert(err);
    			} else {
    				login();
    			}
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Login> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		username = this.value;
    		$$invalidate(0, username);
    	}

    	function input1_input_handler() {
    		password = this.value;
    		$$invalidate(1, password);
    	}

    	$$self.$capture_state = () => ({ user, username, password, login, signup });

    	$$self.$inject_state = $$props => {
    		if ('username' in $$props) $$invalidate(0, username = $$props.username);
    		if ('password' in $$props) $$invalidate(1, password = $$props.password);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [username, password, login, signup, input0_input_handler, input1_input_handler];
    }

    class Login extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Login",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\ChatMessage.svelte generated by Svelte v3.58.0 */

    const file$3 = "src\\ChatMessage.svelte";

    function create_fragment$3(ctx) {
    	let div1;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let p;
    	let t1_value = /*message*/ ctx[0].what + "";
    	let t1;
    	let t2;
    	let time;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			p = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			time = element("time");
    			time.textContent = `${/*ts*/ ctx[3].toLocaleTimeString()}`;
    			if (!src_url_equal(img.src, img_src_value = /*avatar*/ ctx[2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "avatar");
    			add_location(img, file$3, 12, 2, 295);
    			add_location(p, file$3, 14, 4, 362);
    			add_location(time, file$3, 16, 4, 389);
    			attr_dev(div0, "class", "message-text");
    			add_location(div0, file$3, 13, 2, 331);
    			attr_dev(div1, "class", `message ${/*messageClass*/ ctx[1]}`);
    			add_location(div1, file$3, 11, 0, 253);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, p);
    			append_dev(p, t1);
    			append_dev(div0, t2);
    			append_dev(div0, time);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*message*/ 1 && t1_value !== (t1_value = /*message*/ ctx[0].what + "")) set_data_dev(t1, t1_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ChatMessage', slots, []);
    	let { message } = $$props;
    	let { sender } = $$props;
    	const messageClass = message.who === sender ? 'sent' : 'received';
    	const avatar = `https://avatars.dicebear.com/api/initials/${message.who}.svg`;
    	const ts = new Date(message.when);

    	$$self.$$.on_mount.push(function () {
    		if (message === undefined && !('message' in $$props || $$self.$$.bound[$$self.$$.props['message']])) {
    			console.warn("<ChatMessage> was created without expected prop 'message'");
    		}

    		if (sender === undefined && !('sender' in $$props || $$self.$$.bound[$$self.$$.props['sender']])) {
    			console.warn("<ChatMessage> was created without expected prop 'sender'");
    		}
    	});

    	const writable_props = ['message', 'sender'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ChatMessage> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('message' in $$props) $$invalidate(0, message = $$props.message);
    		if ('sender' in $$props) $$invalidate(4, sender = $$props.sender);
    	};

    	$$self.$capture_state = () => ({
    		message,
    		sender,
    		messageClass,
    		avatar,
    		ts
    	});

    	$$self.$inject_state = $$props => {
    		if ('message' in $$props) $$invalidate(0, message = $$props.message);
    		if ('sender' in $$props) $$invalidate(4, sender = $$props.sender);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [message, messageClass, avatar, ts, sender];
    }

    class ChatMessage extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { message: 0, sender: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ChatMessage",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get message() {
    		throw new Error("<ChatMessage>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set message(value) {
    		throw new Error("<ChatMessage>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sender() {
    		throw new Error("<ChatMessage>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sender(value) {
    		throw new Error("<ChatMessage>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * lodash (Custom Build) <https://lodash.com/>
     * Build: `lodash modularize exports="npm" -o ./`
     * Copyright jQuery Foundation and other contributors <https://jquery.org/>
     * Released under MIT license <https://lodash.com/license>
     * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
     * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
     */

    /** Used as the `TypeError` message for "Functions" methods. */
    var FUNC_ERROR_TEXT = 'Expected a function';

    /** Used as references for various `Number` constants. */
    var NAN = 0 / 0;

    /** `Object#toString` result references. */
    var symbolTag = '[object Symbol]';

    /** Used to match leading and trailing whitespace. */
    var reTrim = /^\s+|\s+$/g;

    /** Used to detect bad signed hexadecimal string values. */
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

    /** Used to detect binary string values. */
    var reIsBinary = /^0b[01]+$/i;

    /** Used to detect octal string values. */
    var reIsOctal = /^0o[0-7]+$/i;

    /** Built-in method references without a dependency on `root`. */
    var freeParseInt = parseInt;

    /** Detect free variable `global` from Node.js. */
    var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

    /** Detect free variable `self`. */
    var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

    /** Used as a reference to the global object. */
    var root = freeGlobal || freeSelf || Function('return this')();

    /** Used for built-in method references. */
    var objectProto = Object.prototype;

    /**
     * Used to resolve the
     * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
     * of values.
     */
    var objectToString = objectProto.toString;

    /* Built-in method references for those with the same name as other `lodash` methods. */
    var nativeMax = Math.max,
        nativeMin = Math.min;

    /**
     * Gets the timestamp of the number of milliseconds that have elapsed since
     * the Unix epoch (1 January 1970 00:00:00 UTC).
     *
     * @static
     * @memberOf _
     * @since 2.4.0
     * @category Date
     * @returns {number} Returns the timestamp.
     * @example
     *
     * _.defer(function(stamp) {
     *   console.log(_.now() - stamp);
     * }, _.now());
     * // => Logs the number of milliseconds it took for the deferred invocation.
     */
    var now = function() {
      return root.Date.now();
    };

    /**
     * Creates a debounced function that delays invoking `func` until after `wait`
     * milliseconds have elapsed since the last time the debounced function was
     * invoked. The debounced function comes with a `cancel` method to cancel
     * delayed `func` invocations and a `flush` method to immediately invoke them.
     * Provide `options` to indicate whether `func` should be invoked on the
     * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
     * with the last arguments provided to the debounced function. Subsequent
     * calls to the debounced function return the result of the last `func`
     * invocation.
     *
     * **Note:** If `leading` and `trailing` options are `true`, `func` is
     * invoked on the trailing edge of the timeout only if the debounced function
     * is invoked more than once during the `wait` timeout.
     *
     * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
     * until to the next tick, similar to `setTimeout` with a timeout of `0`.
     *
     * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
     * for details over the differences between `_.debounce` and `_.throttle`.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func The function to debounce.
     * @param {number} [wait=0] The number of milliseconds to delay.
     * @param {Object} [options={}] The options object.
     * @param {boolean} [options.leading=false]
     *  Specify invoking on the leading edge of the timeout.
     * @param {number} [options.maxWait]
     *  The maximum time `func` is allowed to be delayed before it's invoked.
     * @param {boolean} [options.trailing=true]
     *  Specify invoking on the trailing edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * // Avoid costly calculations while the window size is in flux.
     * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
     *
     * // Invoke `sendMail` when clicked, debouncing subsequent calls.
     * jQuery(element).on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * }));
     *
     * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
     * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
     * var source = new EventSource('/stream');
     * jQuery(source).on('message', debounced);
     *
     * // Cancel the trailing debounced invocation.
     * jQuery(window).on('popstate', debounced.cancel);
     */
    function debounce(func, wait, options) {
      var lastArgs,
          lastThis,
          maxWait,
          result,
          timerId,
          lastCallTime,
          lastInvokeTime = 0,
          leading = false,
          maxing = false,
          trailing = true;

      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      wait = toNumber(wait) || 0;
      if (isObject(options)) {
        leading = !!options.leading;
        maxing = 'maxWait' in options;
        maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
        trailing = 'trailing' in options ? !!options.trailing : trailing;
      }

      function invokeFunc(time) {
        var args = lastArgs,
            thisArg = lastThis;

        lastArgs = lastThis = undefined;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
      }

      function leadingEdge(time) {
        // Reset any `maxWait` timer.
        lastInvokeTime = time;
        // Start the timer for the trailing edge.
        timerId = setTimeout(timerExpired, wait);
        // Invoke the leading edge.
        return leading ? invokeFunc(time) : result;
      }

      function remainingWait(time) {
        var timeSinceLastCall = time - lastCallTime,
            timeSinceLastInvoke = time - lastInvokeTime,
            result = wait - timeSinceLastCall;

        return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
      }

      function shouldInvoke(time) {
        var timeSinceLastCall = time - lastCallTime,
            timeSinceLastInvoke = time - lastInvokeTime;

        // Either this is the first call, activity has stopped and we're at the
        // trailing edge, the system time has gone backwards and we're treating
        // it as the trailing edge, or we've hit the `maxWait` limit.
        return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
          (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
      }

      function timerExpired() {
        var time = now();
        if (shouldInvoke(time)) {
          return trailingEdge(time);
        }
        // Restart the timer.
        timerId = setTimeout(timerExpired, remainingWait(time));
      }

      function trailingEdge(time) {
        timerId = undefined;

        // Only invoke if we have `lastArgs` which means `func` has been
        // debounced at least once.
        if (trailing && lastArgs) {
          return invokeFunc(time);
        }
        lastArgs = lastThis = undefined;
        return result;
      }

      function cancel() {
        if (timerId !== undefined) {
          clearTimeout(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = undefined;
      }

      function flush() {
        return timerId === undefined ? result : trailingEdge(now());
      }

      function debounced() {
        var time = now(),
            isInvoking = shouldInvoke(time);

        lastArgs = arguments;
        lastThis = this;
        lastCallTime = time;

        if (isInvoking) {
          if (timerId === undefined) {
            return leadingEdge(lastCallTime);
          }
          if (maxing) {
            // Handle invocations in a tight loop.
            timerId = setTimeout(timerExpired, wait);
            return invokeFunc(lastCallTime);
          }
        }
        if (timerId === undefined) {
          timerId = setTimeout(timerExpired, wait);
        }
        return result;
      }
      debounced.cancel = cancel;
      debounced.flush = flush;
      return debounced;
    }

    /**
     * Checks if `value` is the
     * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
     * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(_.noop);
     * // => true
     *
     * _.isObject(null);
     * // => false
     */
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == 'object' || type == 'function');
    }

    /**
     * Checks if `value` is object-like. A value is object-like if it's not `null`
     * and has a `typeof` result of "object".
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
     * @example
     *
     * _.isObjectLike({});
     * // => true
     *
     * _.isObjectLike([1, 2, 3]);
     * // => true
     *
     * _.isObjectLike(_.noop);
     * // => false
     *
     * _.isObjectLike(null);
     * // => false
     */
    function isObjectLike(value) {
      return !!value && typeof value == 'object';
    }

    /**
     * Checks if `value` is classified as a `Symbol` primitive or object.
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
     * @example
     *
     * _.isSymbol(Symbol.iterator);
     * // => true
     *
     * _.isSymbol('abc');
     * // => false
     */
    function isSymbol(value) {
      return typeof value == 'symbol' ||
        (isObjectLike(value) && objectToString.call(value) == symbolTag);
    }

    /**
     * Converts `value` to a number.
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to process.
     * @returns {number} Returns the number.
     * @example
     *
     * _.toNumber(3.2);
     * // => 3.2
     *
     * _.toNumber(Number.MIN_VALUE);
     * // => 5e-324
     *
     * _.toNumber(Infinity);
     * // => Infinity
     *
     * _.toNumber('3.2');
     * // => 3.2
     */
    function toNumber(value) {
      if (typeof value == 'number') {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
        value = isObject(other) ? (other + '') : other;
      }
      if (typeof value != 'string') {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim, '');
      var isBinary = reIsBinary.test(value);
      return (isBinary || reIsOctal.test(value))
        ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
        : (reIsBadHex.test(value) ? NAN : +value);
    }

    var lodash_debounce = debounce;

    /*!
     * Pusher JavaScript Library v8.0.2
     * https://pusher.com/
     *
     * Copyright 2020, Pusher
     * Released under the MIT licence.
     */

    var pusher = createCommonjsModule(function (module, exports) {
    (function webpackUniversalModuleDefinition(root, factory) {
    	module.exports = factory();
    })(window, function() {
    return /******/ (function(modules) { // webpackBootstrap
    /******/ 	// The module cache
    /******/ 	var installedModules = {};
    /******/
    /******/ 	// The require function
    /******/ 	function __webpack_require__(moduleId) {
    /******/
    /******/ 		// Check if module is in cache
    /******/ 		if(installedModules[moduleId]) {
    /******/ 			return installedModules[moduleId].exports;
    /******/ 		}
    /******/ 		// Create a new module (and put it into the cache)
    /******/ 		var module = installedModules[moduleId] = {
    /******/ 			i: moduleId,
    /******/ 			l: false,
    /******/ 			exports: {}
    /******/ 		};
    /******/
    /******/ 		// Execute the module function
    /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    /******/
    /******/ 		// Flag the module as loaded
    /******/ 		module.l = true;
    /******/
    /******/ 		// Return the exports of the module
    /******/ 		return module.exports;
    /******/ 	}
    /******/
    /******/
    /******/ 	// expose the modules object (__webpack_modules__)
    /******/ 	__webpack_require__.m = modules;
    /******/
    /******/ 	// expose the module cache
    /******/ 	__webpack_require__.c = installedModules;
    /******/
    /******/ 	// define getter function for harmony exports
    /******/ 	__webpack_require__.d = function(exports, name, getter) {
    /******/ 		if(!__webpack_require__.o(exports, name)) {
    /******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
    /******/ 		}
    /******/ 	};
    /******/
    /******/ 	// define __esModule on exports
    /******/ 	__webpack_require__.r = function(exports) {
    /******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
    /******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    /******/ 		}
    /******/ 		Object.defineProperty(exports, '__esModule', { value: true });
    /******/ 	};
    /******/
    /******/ 	// create a fake namespace object
    /******/ 	// mode & 1: value is a module id, require it
    /******/ 	// mode & 2: merge all properties of value into the ns
    /******/ 	// mode & 4: return value when already ns object
    /******/ 	// mode & 8|1: behave like require
    /******/ 	__webpack_require__.t = function(value, mode) {
    /******/ 		if(mode & 1) value = __webpack_require__(value);
    /******/ 		if(mode & 8) return value;
    /******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
    /******/ 		var ns = Object.create(null);
    /******/ 		__webpack_require__.r(ns);
    /******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
    /******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
    /******/ 		return ns;
    /******/ 	};
    /******/
    /******/ 	// getDefaultExport function for compatibility with non-harmony modules
    /******/ 	__webpack_require__.n = function(module) {
    /******/ 		var getter = module && module.__esModule ?
    /******/ 			function getDefault() { return module['default']; } :
    /******/ 			function getModuleExports() { return module; };
    /******/ 		__webpack_require__.d(getter, 'a', getter);
    /******/ 		return getter;
    /******/ 	};
    /******/
    /******/ 	// Object.prototype.hasOwnProperty.call
    /******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
    /******/
    /******/ 	// __webpack_public_path__
    /******/ 	__webpack_require__.p = "";
    /******/
    /******/
    /******/ 	// Load entry module and return exports
    /******/ 	return __webpack_require__(__webpack_require__.s = 2);
    /******/ })
    /************************************************************************/
    /******/ ([
    /* 0 */
    /***/ (function(module, exports, __webpack_require__) {

    // Copyright (C) 2016 Dmitry Chestnykh
    // MIT License. See LICENSE file for details.
    var __extends = (this && this.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * Package base64 implements Base64 encoding and decoding.
     */
    // Invalid character used in decoding to indicate
    // that the character to decode is out of range of
    // alphabet and cannot be decoded.
    var INVALID_BYTE = 256;
    /**
     * Implements standard Base64 encoding.
     *
     * Operates in constant time.
     */
    var Coder = /** @class */ (function () {
        // TODO(dchest): methods to encode chunk-by-chunk.
        function Coder(_paddingCharacter) {
            if (_paddingCharacter === void 0) { _paddingCharacter = "="; }
            this._paddingCharacter = _paddingCharacter;
        }
        Coder.prototype.encodedLength = function (length) {
            if (!this._paddingCharacter) {
                return (length * 8 + 5) / 6 | 0;
            }
            return (length + 2) / 3 * 4 | 0;
        };
        Coder.prototype.encode = function (data) {
            var out = "";
            var i = 0;
            for (; i < data.length - 2; i += 3) {
                var c = (data[i] << 16) | (data[i + 1] << 8) | (data[i + 2]);
                out += this._encodeByte((c >>> 3 * 6) & 63);
                out += this._encodeByte((c >>> 2 * 6) & 63);
                out += this._encodeByte((c >>> 1 * 6) & 63);
                out += this._encodeByte((c >>> 0 * 6) & 63);
            }
            var left = data.length - i;
            if (left > 0) {
                var c = (data[i] << 16) | (left === 2 ? data[i + 1] << 8 : 0);
                out += this._encodeByte((c >>> 3 * 6) & 63);
                out += this._encodeByte((c >>> 2 * 6) & 63);
                if (left === 2) {
                    out += this._encodeByte((c >>> 1 * 6) & 63);
                }
                else {
                    out += this._paddingCharacter || "";
                }
                out += this._paddingCharacter || "";
            }
            return out;
        };
        Coder.prototype.maxDecodedLength = function (length) {
            if (!this._paddingCharacter) {
                return (length * 6 + 7) / 8 | 0;
            }
            return length / 4 * 3 | 0;
        };
        Coder.prototype.decodedLength = function (s) {
            return this.maxDecodedLength(s.length - this._getPaddingLength(s));
        };
        Coder.prototype.decode = function (s) {
            if (s.length === 0) {
                return new Uint8Array(0);
            }
            var paddingLength = this._getPaddingLength(s);
            var length = s.length - paddingLength;
            var out = new Uint8Array(this.maxDecodedLength(length));
            var op = 0;
            var i = 0;
            var haveBad = 0;
            var v0 = 0, v1 = 0, v2 = 0, v3 = 0;
            for (; i < length - 4; i += 4) {
                v0 = this._decodeChar(s.charCodeAt(i + 0));
                v1 = this._decodeChar(s.charCodeAt(i + 1));
                v2 = this._decodeChar(s.charCodeAt(i + 2));
                v3 = this._decodeChar(s.charCodeAt(i + 3));
                out[op++] = (v0 << 2) | (v1 >>> 4);
                out[op++] = (v1 << 4) | (v2 >>> 2);
                out[op++] = (v2 << 6) | v3;
                haveBad |= v0 & INVALID_BYTE;
                haveBad |= v1 & INVALID_BYTE;
                haveBad |= v2 & INVALID_BYTE;
                haveBad |= v3 & INVALID_BYTE;
            }
            if (i < length - 1) {
                v0 = this._decodeChar(s.charCodeAt(i));
                v1 = this._decodeChar(s.charCodeAt(i + 1));
                out[op++] = (v0 << 2) | (v1 >>> 4);
                haveBad |= v0 & INVALID_BYTE;
                haveBad |= v1 & INVALID_BYTE;
            }
            if (i < length - 2) {
                v2 = this._decodeChar(s.charCodeAt(i + 2));
                out[op++] = (v1 << 4) | (v2 >>> 2);
                haveBad |= v2 & INVALID_BYTE;
            }
            if (i < length - 3) {
                v3 = this._decodeChar(s.charCodeAt(i + 3));
                out[op++] = (v2 << 6) | v3;
                haveBad |= v3 & INVALID_BYTE;
            }
            if (haveBad !== 0) {
                throw new Error("Base64Coder: incorrect characters for decoding");
            }
            return out;
        };
        // Standard encoding have the following encoded/decoded ranges,
        // which we need to convert between.
        //
        // ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789  +   /
        // Index:   0 - 25                    26 - 51              52 - 61   62  63
        // ASCII:  65 - 90                    97 - 122             48 - 57   43  47
        //
        // Encode 6 bits in b into a new character.
        Coder.prototype._encodeByte = function (b) {
            // Encoding uses constant time operations as follows:
            //
            // 1. Define comparison of A with B using (A - B) >>> 8:
            //          if A > B, then result is positive integer
            //          if A <= B, then result is 0
            //
            // 2. Define selection of C or 0 using bitwise AND: X & C:
            //          if X == 0, then result is 0
            //          if X != 0, then result is C
            //
            // 3. Start with the smallest comparison (b >= 0), which is always
            //    true, so set the result to the starting ASCII value (65).
            //
            // 4. Continue comparing b to higher ASCII values, and selecting
            //    zero if comparison isn't true, otherwise selecting a value
            //    to add to result, which:
            //
            //          a) undoes the previous addition
            //          b) provides new value to add
            //
            var result = b;
            // b >= 0
            result += 65;
            // b > 25
            result += ((25 - b) >>> 8) & ((0 - 65) - 26 + 97);
            // b > 51
            result += ((51 - b) >>> 8) & ((26 - 97) - 52 + 48);
            // b > 61
            result += ((61 - b) >>> 8) & ((52 - 48) - 62 + 43);
            // b > 62
            result += ((62 - b) >>> 8) & ((62 - 43) - 63 + 47);
            return String.fromCharCode(result);
        };
        // Decode a character code into a byte.
        // Must return 256 if character is out of alphabet range.
        Coder.prototype._decodeChar = function (c) {
            // Decoding works similar to encoding: using the same comparison
            // function, but now it works on ranges: result is always incremented
            // by value, but this value becomes zero if the range is not
            // satisfied.
            //
            // Decoding starts with invalid value, 256, which is then
            // subtracted when the range is satisfied. If none of the ranges
            // apply, the function returns 256, which is then checked by
            // the caller to throw error.
            var result = INVALID_BYTE; // start with invalid character
            // c == 43 (c > 42 and c < 44)
            result += (((42 - c) & (c - 44)) >>> 8) & (-INVALID_BYTE + c - 43 + 62);
            // c == 47 (c > 46 and c < 48)
            result += (((46 - c) & (c - 48)) >>> 8) & (-INVALID_BYTE + c - 47 + 63);
            // c > 47 and c < 58
            result += (((47 - c) & (c - 58)) >>> 8) & (-INVALID_BYTE + c - 48 + 52);
            // c > 64 and c < 91
            result += (((64 - c) & (c - 91)) >>> 8) & (-INVALID_BYTE + c - 65 + 0);
            // c > 96 and c < 123
            result += (((96 - c) & (c - 123)) >>> 8) & (-INVALID_BYTE + c - 97 + 26);
            return result;
        };
        Coder.prototype._getPaddingLength = function (s) {
            var paddingLength = 0;
            if (this._paddingCharacter) {
                for (var i = s.length - 1; i >= 0; i--) {
                    if (s[i] !== this._paddingCharacter) {
                        break;
                    }
                    paddingLength++;
                }
                if (s.length < 4 || paddingLength > 2) {
                    throw new Error("Base64Coder: incorrect padding");
                }
            }
            return paddingLength;
        };
        return Coder;
    }());
    exports.Coder = Coder;
    var stdCoder = new Coder();
    function encode(data) {
        return stdCoder.encode(data);
    }
    exports.encode = encode;
    function decode(s) {
        return stdCoder.decode(s);
    }
    exports.decode = decode;
    /**
     * Implements URL-safe Base64 encoding.
     * (Same as Base64, but '+' is replaced with '-', and '/' with '_').
     *
     * Operates in constant time.
     */
    var URLSafeCoder = /** @class */ (function (_super) {
        __extends(URLSafeCoder, _super);
        function URLSafeCoder() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        // URL-safe encoding have the following encoded/decoded ranges:
        //
        // ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789  -   _
        // Index:   0 - 25                    26 - 51              52 - 61   62  63
        // ASCII:  65 - 90                    97 - 122             48 - 57   45  95
        //
        URLSafeCoder.prototype._encodeByte = function (b) {
            var result = b;
            // b >= 0
            result += 65;
            // b > 25
            result += ((25 - b) >>> 8) & ((0 - 65) - 26 + 97);
            // b > 51
            result += ((51 - b) >>> 8) & ((26 - 97) - 52 + 48);
            // b > 61
            result += ((61 - b) >>> 8) & ((52 - 48) - 62 + 45);
            // b > 62
            result += ((62 - b) >>> 8) & ((62 - 45) - 63 + 95);
            return String.fromCharCode(result);
        };
        URLSafeCoder.prototype._decodeChar = function (c) {
            var result = INVALID_BYTE;
            // c == 45 (c > 44 and c < 46)
            result += (((44 - c) & (c - 46)) >>> 8) & (-INVALID_BYTE + c - 45 + 62);
            // c == 95 (c > 94 and c < 96)
            result += (((94 - c) & (c - 96)) >>> 8) & (-INVALID_BYTE + c - 95 + 63);
            // c > 47 and c < 58
            result += (((47 - c) & (c - 58)) >>> 8) & (-INVALID_BYTE + c - 48 + 52);
            // c > 64 and c < 91
            result += (((64 - c) & (c - 91)) >>> 8) & (-INVALID_BYTE + c - 65 + 0);
            // c > 96 and c < 123
            result += (((96 - c) & (c - 123)) >>> 8) & (-INVALID_BYTE + c - 97 + 26);
            return result;
        };
        return URLSafeCoder;
    }(Coder));
    exports.URLSafeCoder = URLSafeCoder;
    var urlSafeCoder = new URLSafeCoder();
    function encodeURLSafe(data) {
        return urlSafeCoder.encode(data);
    }
    exports.encodeURLSafe = encodeURLSafe;
    function decodeURLSafe(s) {
        return urlSafeCoder.decode(s);
    }
    exports.decodeURLSafe = decodeURLSafe;
    exports.encodedLength = function (length) {
        return stdCoder.encodedLength(length);
    };
    exports.maxDecodedLength = function (length) {
        return stdCoder.maxDecodedLength(length);
    };
    exports.decodedLength = function (s) {
        return stdCoder.decodedLength(s);
    };


    /***/ }),
    /* 1 */
    /***/ (function(module, exports, __webpack_require__) {

    // Copyright (C) 2016 Dmitry Chestnykh
    // MIT License. See LICENSE file for details.
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * Package utf8 implements UTF-8 encoding and decoding.
     */
    var INVALID_UTF16 = "utf8: invalid string";
    var INVALID_UTF8 = "utf8: invalid source encoding";
    /**
     * Encodes the given string into UTF-8 byte array.
     * Throws if the source string has invalid UTF-16 encoding.
     */
    function encode(s) {
        // Calculate result length and allocate output array.
        // encodedLength() also validates string and throws errors,
        // so we don't need repeat validation here.
        var arr = new Uint8Array(encodedLength(s));
        var pos = 0;
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            if (c < 0x80) {
                arr[pos++] = c;
            }
            else if (c < 0x800) {
                arr[pos++] = 0xc0 | c >> 6;
                arr[pos++] = 0x80 | c & 0x3f;
            }
            else if (c < 0xd800) {
                arr[pos++] = 0xe0 | c >> 12;
                arr[pos++] = 0x80 | (c >> 6) & 0x3f;
                arr[pos++] = 0x80 | c & 0x3f;
            }
            else {
                i++; // get one more character
                c = (c & 0x3ff) << 10;
                c |= s.charCodeAt(i) & 0x3ff;
                c += 0x10000;
                arr[pos++] = 0xf0 | c >> 18;
                arr[pos++] = 0x80 | (c >> 12) & 0x3f;
                arr[pos++] = 0x80 | (c >> 6) & 0x3f;
                arr[pos++] = 0x80 | c & 0x3f;
            }
        }
        return arr;
    }
    exports.encode = encode;
    /**
     * Returns the number of bytes required to encode the given string into UTF-8.
     * Throws if the source string has invalid UTF-16 encoding.
     */
    function encodedLength(s) {
        var result = 0;
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            if (c < 0x80) {
                result += 1;
            }
            else if (c < 0x800) {
                result += 2;
            }
            else if (c < 0xd800) {
                result += 3;
            }
            else if (c <= 0xdfff) {
                if (i >= s.length - 1) {
                    throw new Error(INVALID_UTF16);
                }
                i++; // "eat" next character
                result += 4;
            }
            else {
                throw new Error(INVALID_UTF16);
            }
        }
        return result;
    }
    exports.encodedLength = encodedLength;
    /**
     * Decodes the given byte array from UTF-8 into a string.
     * Throws if encoding is invalid.
     */
    function decode(arr) {
        var chars = [];
        for (var i = 0; i < arr.length; i++) {
            var b = arr[i];
            if (b & 0x80) {
                var min = void 0;
                if (b < 0xe0) {
                    // Need 1 more byte.
                    if (i >= arr.length) {
                        throw new Error(INVALID_UTF8);
                    }
                    var n1 = arr[++i];
                    if ((n1 & 0xc0) !== 0x80) {
                        throw new Error(INVALID_UTF8);
                    }
                    b = (b & 0x1f) << 6 | (n1 & 0x3f);
                    min = 0x80;
                }
                else if (b < 0xf0) {
                    // Need 2 more bytes.
                    if (i >= arr.length - 1) {
                        throw new Error(INVALID_UTF8);
                    }
                    var n1 = arr[++i];
                    var n2 = arr[++i];
                    if ((n1 & 0xc0) !== 0x80 || (n2 & 0xc0) !== 0x80) {
                        throw new Error(INVALID_UTF8);
                    }
                    b = (b & 0x0f) << 12 | (n1 & 0x3f) << 6 | (n2 & 0x3f);
                    min = 0x800;
                }
                else if (b < 0xf8) {
                    // Need 3 more bytes.
                    if (i >= arr.length - 2) {
                        throw new Error(INVALID_UTF8);
                    }
                    var n1 = arr[++i];
                    var n2 = arr[++i];
                    var n3 = arr[++i];
                    if ((n1 & 0xc0) !== 0x80 || (n2 & 0xc0) !== 0x80 || (n3 & 0xc0) !== 0x80) {
                        throw new Error(INVALID_UTF8);
                    }
                    b = (b & 0x0f) << 18 | (n1 & 0x3f) << 12 | (n2 & 0x3f) << 6 | (n3 & 0x3f);
                    min = 0x10000;
                }
                else {
                    throw new Error(INVALID_UTF8);
                }
                if (b < min || (b >= 0xd800 && b <= 0xdfff)) {
                    throw new Error(INVALID_UTF8);
                }
                if (b >= 0x10000) {
                    // Surrogate pair.
                    if (b > 0x10ffff) {
                        throw new Error(INVALID_UTF8);
                    }
                    b -= 0x10000;
                    chars.push(String.fromCharCode(0xd800 | (b >> 10)));
                    b = 0xdc00 | (b & 0x3ff);
                }
            }
            chars.push(String.fromCharCode(b));
        }
        return chars.join("");
    }
    exports.decode = decode;


    /***/ }),
    /* 2 */
    /***/ (function(module, exports, __webpack_require__) {

    // required so we don't have to do require('pusher').default etc.
    module.exports = __webpack_require__(3).default;


    /***/ }),
    /* 3 */
    /***/ (function(module, __webpack_exports__, __webpack_require__) {
    // ESM COMPAT FLAG
    __webpack_require__.r(__webpack_exports__);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/script_receiver_factory.ts
    var ScriptReceiverFactory = (function () {
        function ScriptReceiverFactory(prefix, name) {
            this.lastId = 0;
            this.prefix = prefix;
            this.name = name;
        }
        ScriptReceiverFactory.prototype.create = function (callback) {
            this.lastId++;
            var number = this.lastId;
            var id = this.prefix + number;
            var name = this.name + '[' + number + ']';
            var called = false;
            var callbackWrapper = function () {
                if (!called) {
                    callback.apply(null, arguments);
                    called = true;
                }
            };
            this[number] = callbackWrapper;
            return { number: number, id: id, name: name, callback: callbackWrapper };
        };
        ScriptReceiverFactory.prototype.remove = function (receiver) {
            delete this[receiver.number];
        };
        return ScriptReceiverFactory;
    }());

    var ScriptReceivers = new ScriptReceiverFactory('_pusher_script_', 'Pusher.ScriptReceivers');

    // CONCATENATED MODULE: ./src/core/defaults.ts
    var Defaults = {
        VERSION: "8.0.2",
        PROTOCOL: 7,
        wsPort: 80,
        wssPort: 443,
        wsPath: '',
        httpHost: 'sockjs.pusher.com',
        httpPort: 80,
        httpsPort: 443,
        httpPath: '/pusher',
        stats_host: 'stats.pusher.com',
        authEndpoint: '/pusher/auth',
        authTransport: 'ajax',
        activityTimeout: 120000,
        pongTimeout: 30000,
        unavailableTimeout: 10000,
        userAuthentication: {
            endpoint: '/pusher/user-auth',
            transport: 'ajax'
        },
        channelAuthorization: {
            endpoint: '/pusher/auth',
            transport: 'ajax'
        },
        cdn_http: "http://js.pusher.com",
        cdn_https: "https://js.pusher.com",
        dependency_suffix: ""
    };
    /* harmony default export */ var defaults = (Defaults);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/dependency_loader.ts


    var dependency_loader_DependencyLoader = (function () {
        function DependencyLoader(options) {
            this.options = options;
            this.receivers = options.receivers || ScriptReceivers;
            this.loading = {};
        }
        DependencyLoader.prototype.load = function (name, options, callback) {
            var self = this;
            if (self.loading[name] && self.loading[name].length > 0) {
                self.loading[name].push(callback);
            }
            else {
                self.loading[name] = [callback];
                var request = runtime.createScriptRequest(self.getPath(name, options));
                var receiver = self.receivers.create(function (error) {
                    self.receivers.remove(receiver);
                    if (self.loading[name]) {
                        var callbacks = self.loading[name];
                        delete self.loading[name];
                        var successCallback = function (wasSuccessful) {
                            if (!wasSuccessful) {
                                request.cleanup();
                            }
                        };
                        for (var i = 0; i < callbacks.length; i++) {
                            callbacks[i](error, successCallback);
                        }
                    }
                });
                request.send(receiver);
            }
        };
        DependencyLoader.prototype.getRoot = function (options) {
            var cdn;
            var protocol = runtime.getDocument().location.protocol;
            if ((options && options.useTLS) || protocol === 'https:') {
                cdn = this.options.cdn_https;
            }
            else {
                cdn = this.options.cdn_http;
            }
            return cdn.replace(/\/*$/, '') + '/' + this.options.version;
        };
        DependencyLoader.prototype.getPath = function (name, options) {
            return this.getRoot(options) + '/' + name + this.options.suffix + '.js';
        };
        return DependencyLoader;
    }());
    /* harmony default export */ var dependency_loader = (dependency_loader_DependencyLoader);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/dependencies.ts



    var DependenciesReceivers = new ScriptReceiverFactory('_pusher_dependencies', 'Pusher.DependenciesReceivers');
    var Dependencies = new dependency_loader({
        cdn_http: defaults.cdn_http,
        cdn_https: defaults.cdn_https,
        version: defaults.VERSION,
        suffix: defaults.dependency_suffix,
        receivers: DependenciesReceivers
    });

    // CONCATENATED MODULE: ./src/core/utils/url_store.ts
    var urlStore = {
        baseUrl: 'https://pusher.com',
        urls: {
            authenticationEndpoint: {
                path: '/docs/channels/server_api/authenticating_users'
            },
            authorizationEndpoint: {
                path: '/docs/channels/server_api/authorizing-users/'
            },
            javascriptQuickStart: {
                path: '/docs/javascript_quick_start'
            },
            triggeringClientEvents: {
                path: '/docs/client_api_guide/client_events#trigger-events'
            },
            encryptedChannelSupport: {
                fullUrl: 'https://github.com/pusher/pusher-js/tree/cc491015371a4bde5743d1c87a0fbac0feb53195#encrypted-channel-support'
            }
        }
    };
    var buildLogSuffix = function (key) {
        var urlPrefix = 'See:';
        var urlObj = urlStore.urls[key];
        if (!urlObj)
            return '';
        var url;
        if (urlObj.fullUrl) {
            url = urlObj.fullUrl;
        }
        else if (urlObj.path) {
            url = urlStore.baseUrl + urlObj.path;
        }
        if (!url)
            return '';
        return urlPrefix + " " + url;
    };
    /* harmony default export */ var url_store = ({ buildLogSuffix: buildLogSuffix });

    // CONCATENATED MODULE: ./src/core/auth/options.ts
    var AuthRequestType;
    (function (AuthRequestType) {
        AuthRequestType["UserAuthentication"] = "user-authentication";
        AuthRequestType["ChannelAuthorization"] = "channel-authorization";
    })(AuthRequestType || (AuthRequestType = {}));

    // CONCATENATED MODULE: ./src/core/errors.ts
    var __extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var BadEventName = (function (_super) {
        __extends(BadEventName, _super);
        function BadEventName(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return BadEventName;
    }(Error));

    var BadChannelName = (function (_super) {
        __extends(BadChannelName, _super);
        function BadChannelName(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return BadChannelName;
    }(Error));

    var RequestTimedOut = (function (_super) {
        __extends(RequestTimedOut, _super);
        function RequestTimedOut(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return RequestTimedOut;
    }(Error));

    var TransportPriorityTooLow = (function (_super) {
        __extends(TransportPriorityTooLow, _super);
        function TransportPriorityTooLow(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return TransportPriorityTooLow;
    }(Error));

    var TransportClosed = (function (_super) {
        __extends(TransportClosed, _super);
        function TransportClosed(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return TransportClosed;
    }(Error));

    var UnsupportedFeature = (function (_super) {
        __extends(UnsupportedFeature, _super);
        function UnsupportedFeature(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return UnsupportedFeature;
    }(Error));

    var UnsupportedTransport = (function (_super) {
        __extends(UnsupportedTransport, _super);
        function UnsupportedTransport(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return UnsupportedTransport;
    }(Error));

    var UnsupportedStrategy = (function (_super) {
        __extends(UnsupportedStrategy, _super);
        function UnsupportedStrategy(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return UnsupportedStrategy;
    }(Error));

    var HTTPAuthError = (function (_super) {
        __extends(HTTPAuthError, _super);
        function HTTPAuthError(status, msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            _this.status = status;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return HTTPAuthError;
    }(Error));


    // CONCATENATED MODULE: ./src/runtimes/isomorphic/auth/xhr_auth.ts




    var ajax = function (context, query, authOptions, authRequestType, callback) {
        var xhr = runtime.createXHR();
        xhr.open('POST', authOptions.endpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        for (var headerName in authOptions.headers) {
            xhr.setRequestHeader(headerName, authOptions.headers[headerName]);
        }
        if (authOptions.headersProvider != null) {
            var dynamicHeaders = authOptions.headersProvider();
            for (var headerName in dynamicHeaders) {
                xhr.setRequestHeader(headerName, dynamicHeaders[headerName]);
            }
        }
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var data = void 0;
                    var parsed = false;
                    try {
                        data = JSON.parse(xhr.responseText);
                        parsed = true;
                    }
                    catch (e) {
                        callback(new HTTPAuthError(200, "JSON returned from " + authRequestType.toString() + " endpoint was invalid, yet status code was 200. Data was: " + xhr.responseText), null);
                    }
                    if (parsed) {
                        callback(null, data);
                    }
                }
                else {
                    var suffix = '';
                    switch (authRequestType) {
                        case AuthRequestType.UserAuthentication:
                            suffix = url_store.buildLogSuffix('authenticationEndpoint');
                            break;
                        case AuthRequestType.ChannelAuthorization:
                            suffix = "Clients must be authorized to join private or presence channels. " + url_store.buildLogSuffix('authorizationEndpoint');
                            break;
                    }
                    callback(new HTTPAuthError(xhr.status, "Unable to retrieve auth string from " + authRequestType.toString() + " endpoint - " +
                        ("received status: " + xhr.status + " from " + authOptions.endpoint + ". " + suffix)), null);
                }
            }
        };
        xhr.send(query);
        return xhr;
    };
    /* harmony default export */ var xhr_auth = (ajax);

    // CONCATENATED MODULE: ./src/core/base64.ts
    function encode(s) {
        return btoa(utob(s));
    }
    var fromCharCode = String.fromCharCode;
    var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var b64tab = {};
    for (var base64_i = 0, l = b64chars.length; base64_i < l; base64_i++) {
        b64tab[b64chars.charAt(base64_i)] = base64_i;
    }
    var cb_utob = function (c) {
        var cc = c.charCodeAt(0);
        return cc < 0x80
            ? c
            : cc < 0x800
                ? fromCharCode(0xc0 | (cc >>> 6)) + fromCharCode(0x80 | (cc & 0x3f))
                : fromCharCode(0xe0 | ((cc >>> 12) & 0x0f)) +
                    fromCharCode(0x80 | ((cc >>> 6) & 0x3f)) +
                    fromCharCode(0x80 | (cc & 0x3f));
    };
    var utob = function (u) {
        return u.replace(/[^\x00-\x7F]/g, cb_utob);
    };
    var cb_encode = function (ccc) {
        var padlen = [0, 2, 1][ccc.length % 3];
        var ord = (ccc.charCodeAt(0) << 16) |
            ((ccc.length > 1 ? ccc.charCodeAt(1) : 0) << 8) |
            (ccc.length > 2 ? ccc.charCodeAt(2) : 0);
        var chars = [
            b64chars.charAt(ord >>> 18),
            b64chars.charAt((ord >>> 12) & 63),
            padlen >= 2 ? '=' : b64chars.charAt((ord >>> 6) & 63),
            padlen >= 1 ? '=' : b64chars.charAt(ord & 63)
        ];
        return chars.join('');
    };
    var btoa = window.btoa ||
        function (b) {
            return b.replace(/[\s\S]{1,3}/g, cb_encode);
        };

    // CONCATENATED MODULE: ./src/core/utils/timers/abstract_timer.ts
    var Timer = (function () {
        function Timer(set, clear, delay, callback) {
            var _this = this;
            this.clear = clear;
            this.timer = set(function () {
                if (_this.timer) {
                    _this.timer = callback(_this.timer);
                }
            }, delay);
        }
        Timer.prototype.isRunning = function () {
            return this.timer !== null;
        };
        Timer.prototype.ensureAborted = function () {
            if (this.timer) {
                this.clear(this.timer);
                this.timer = null;
            }
        };
        return Timer;
    }());
    /* harmony default export */ var abstract_timer = (Timer);

    // CONCATENATED MODULE: ./src/core/utils/timers/index.ts
    var timers_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();

    function timers_clearTimeout(timer) {
        window.clearTimeout(timer);
    }
    function timers_clearInterval(timer) {
        window.clearInterval(timer);
    }
    var OneOffTimer = (function (_super) {
        timers_extends(OneOffTimer, _super);
        function OneOffTimer(delay, callback) {
            return _super.call(this, setTimeout, timers_clearTimeout, delay, function (timer) {
                callback();
                return null;
            }) || this;
        }
        return OneOffTimer;
    }(abstract_timer));

    var PeriodicTimer = (function (_super) {
        timers_extends(PeriodicTimer, _super);
        function PeriodicTimer(delay, callback) {
            return _super.call(this, setInterval, timers_clearInterval, delay, function (timer) {
                callback();
                return timer;
            }) || this;
        }
        return PeriodicTimer;
    }(abstract_timer));


    // CONCATENATED MODULE: ./src/core/util.ts

    var Util = {
        now: function () {
            if (Date.now) {
                return Date.now();
            }
            else {
                return new Date().valueOf();
            }
        },
        defer: function (callback) {
            return new OneOffTimer(0, callback);
        },
        method: function (name) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var boundArguments = Array.prototype.slice.call(arguments, 1);
            return function (object) {
                return object[name].apply(object, boundArguments.concat(arguments));
            };
        }
    };
    /* harmony default export */ var util = (Util);

    // CONCATENATED MODULE: ./src/core/utils/collections.ts


    function extend(target) {
        var sources = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            sources[_i - 1] = arguments[_i];
        }
        for (var i = 0; i < sources.length; i++) {
            var extensions = sources[i];
            for (var property in extensions) {
                if (extensions[property] &&
                    extensions[property].constructor &&
                    extensions[property].constructor === Object) {
                    target[property] = extend(target[property] || {}, extensions[property]);
                }
                else {
                    target[property] = extensions[property];
                }
            }
        }
        return target;
    }
    function stringify() {
        var m = ['Pusher'];
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] === 'string') {
                m.push(arguments[i]);
            }
            else {
                m.push(safeJSONStringify(arguments[i]));
            }
        }
        return m.join(' : ');
    }
    function arrayIndexOf(array, item) {
        var nativeIndexOf = Array.prototype.indexOf;
        if (array === null) {
            return -1;
        }
        if (nativeIndexOf && array.indexOf === nativeIndexOf) {
            return array.indexOf(item);
        }
        for (var i = 0, l = array.length; i < l; i++) {
            if (array[i] === item) {
                return i;
            }
        }
        return -1;
    }
    function objectApply(object, f) {
        for (var key in object) {
            if (Object.prototype.hasOwnProperty.call(object, key)) {
                f(object[key], key, object);
            }
        }
    }
    function keys(object) {
        var keys = [];
        objectApply(object, function (_, key) {
            keys.push(key);
        });
        return keys;
    }
    function values(object) {
        var values = [];
        objectApply(object, function (value) {
            values.push(value);
        });
        return values;
    }
    function apply(array, f, context) {
        for (var i = 0; i < array.length; i++) {
            f.call(context || window, array[i], i, array);
        }
    }
    function map(array, f) {
        var result = [];
        for (var i = 0; i < array.length; i++) {
            result.push(f(array[i], i, array, result));
        }
        return result;
    }
    function mapObject(object, f) {
        var result = {};
        objectApply(object, function (value, key) {
            result[key] = f(value);
        });
        return result;
    }
    function filter(array, test) {
        test =
            test ||
                function (value) {
                    return !!value;
                };
        var result = [];
        for (var i = 0; i < array.length; i++) {
            if (test(array[i], i, array, result)) {
                result.push(array[i]);
            }
        }
        return result;
    }
    function filterObject(object, test) {
        var result = {};
        objectApply(object, function (value, key) {
            if ((test && test(value, key, object, result)) || Boolean(value)) {
                result[key] = value;
            }
        });
        return result;
    }
    function flatten(object) {
        var result = [];
        objectApply(object, function (value, key) {
            result.push([key, value]);
        });
        return result;
    }
    function any(array, test) {
        for (var i = 0; i < array.length; i++) {
            if (test(array[i], i, array)) {
                return true;
            }
        }
        return false;
    }
    function collections_all(array, test) {
        for (var i = 0; i < array.length; i++) {
            if (!test(array[i], i, array)) {
                return false;
            }
        }
        return true;
    }
    function encodeParamsObject(data) {
        return mapObject(data, function (value) {
            if (typeof value === 'object') {
                value = safeJSONStringify(value);
            }
            return encodeURIComponent(encode(value.toString()));
        });
    }
    function buildQueryString(data) {
        var params = filterObject(data, function (value) {
            return value !== undefined;
        });
        var query = map(flatten(encodeParamsObject(params)), util.method('join', '=')).join('&');
        return query;
    }
    function decycleObject(object) {
        var objects = [], paths = [];
        return (function derez(value, path) {
            var i, name, nu;
            switch (typeof value) {
                case 'object':
                    if (!value) {
                        return null;
                    }
                    for (i = 0; i < objects.length; i += 1) {
                        if (objects[i] === value) {
                            return { $ref: paths[i] };
                        }
                    }
                    objects.push(value);
                    paths.push(path);
                    if (Object.prototype.toString.apply(value) === '[object Array]') {
                        nu = [];
                        for (i = 0; i < value.length; i += 1) {
                            nu[i] = derez(value[i], path + '[' + i + ']');
                        }
                    }
                    else {
                        nu = {};
                        for (name in value) {
                            if (Object.prototype.hasOwnProperty.call(value, name)) {
                                nu[name] = derez(value[name], path + '[' + JSON.stringify(name) + ']');
                            }
                        }
                    }
                    return nu;
                case 'number':
                case 'string':
                case 'boolean':
                    return value;
            }
        })(object, '$');
    }
    function safeJSONStringify(source) {
        try {
            return JSON.stringify(source);
        }
        catch (e) {
            return JSON.stringify(decycleObject(source));
        }
    }

    // CONCATENATED MODULE: ./src/core/logger.ts


    var logger_Logger = (function () {
        function Logger() {
            this.globalLog = function (message) {
                if (window.console && window.console.log) {
                    window.console.log(message);
                }
            };
        }
        Logger.prototype.debug = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            this.log(this.globalLog, args);
        };
        Logger.prototype.warn = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            this.log(this.globalLogWarn, args);
        };
        Logger.prototype.error = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            this.log(this.globalLogError, args);
        };
        Logger.prototype.globalLogWarn = function (message) {
            if (window.console && window.console.warn) {
                window.console.warn(message);
            }
            else {
                this.globalLog(message);
            }
        };
        Logger.prototype.globalLogError = function (message) {
            if (window.console && window.console.error) {
                window.console.error(message);
            }
            else {
                this.globalLogWarn(message);
            }
        };
        Logger.prototype.log = function (defaultLoggingFunction) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var message = stringify.apply(this, arguments);
            if (core_pusher.log) {
                core_pusher.log(message);
            }
            else if (core_pusher.logToConsole) {
                var log = defaultLoggingFunction.bind(this);
                log(message);
            }
        };
        return Logger;
    }());
    /* harmony default export */ var logger = (new logger_Logger());

    // CONCATENATED MODULE: ./src/runtimes/web/auth/jsonp_auth.ts

    var jsonp = function (context, query, authOptions, authRequestType, callback) {
        if (authOptions.headers !== undefined ||
            authOptions.headersProvider != null) {
            logger.warn("To send headers with the " + authRequestType.toString() + " request, you must use AJAX, rather than JSONP.");
        }
        var callbackName = context.nextAuthCallbackID.toString();
        context.nextAuthCallbackID++;
        var document = context.getDocument();
        var script = document.createElement('script');
        context.auth_callbacks[callbackName] = function (data) {
            callback(null, data);
        };
        var callback_name = "Pusher.auth_callbacks['" + callbackName + "']";
        script.src =
            authOptions.endpoint +
                '?callback=' +
                encodeURIComponent(callback_name) +
                '&' +
                query;
        var head = document.getElementsByTagName('head')[0] || document.documentElement;
        head.insertBefore(script, head.firstChild);
    };
    /* harmony default export */ var jsonp_auth = (jsonp);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/script_request.ts
    var ScriptRequest = (function () {
        function ScriptRequest(src) {
            this.src = src;
        }
        ScriptRequest.prototype.send = function (receiver) {
            var self = this;
            var errorString = 'Error loading ' + self.src;
            self.script = document.createElement('script');
            self.script.id = receiver.id;
            self.script.src = self.src;
            self.script.type = 'text/javascript';
            self.script.charset = 'UTF-8';
            if (self.script.addEventListener) {
                self.script.onerror = function () {
                    receiver.callback(errorString);
                };
                self.script.onload = function () {
                    receiver.callback(null);
                };
            }
            else {
                self.script.onreadystatechange = function () {
                    if (self.script.readyState === 'loaded' ||
                        self.script.readyState === 'complete') {
                        receiver.callback(null);
                    }
                };
            }
            if (self.script.async === undefined &&
                document.attachEvent &&
                /opera/i.test(navigator.userAgent)) {
                self.errorScript = document.createElement('script');
                self.errorScript.id = receiver.id + '_error';
                self.errorScript.text = receiver.name + "('" + errorString + "');";
                self.script.async = self.errorScript.async = false;
            }
            else {
                self.script.async = true;
            }
            var head = document.getElementsByTagName('head')[0];
            head.insertBefore(self.script, head.firstChild);
            if (self.errorScript) {
                head.insertBefore(self.errorScript, self.script.nextSibling);
            }
        };
        ScriptRequest.prototype.cleanup = function () {
            if (this.script) {
                this.script.onload = this.script.onerror = null;
                this.script.onreadystatechange = null;
            }
            if (this.script && this.script.parentNode) {
                this.script.parentNode.removeChild(this.script);
            }
            if (this.errorScript && this.errorScript.parentNode) {
                this.errorScript.parentNode.removeChild(this.errorScript);
            }
            this.script = null;
            this.errorScript = null;
        };
        return ScriptRequest;
    }());
    /* harmony default export */ var script_request = (ScriptRequest);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/jsonp_request.ts


    var jsonp_request_JSONPRequest = (function () {
        function JSONPRequest(url, data) {
            this.url = url;
            this.data = data;
        }
        JSONPRequest.prototype.send = function (receiver) {
            if (this.request) {
                return;
            }
            var query = buildQueryString(this.data);
            var url = this.url + '/' + receiver.number + '?' + query;
            this.request = runtime.createScriptRequest(url);
            this.request.send(receiver);
        };
        JSONPRequest.prototype.cleanup = function () {
            if (this.request) {
                this.request.cleanup();
            }
        };
        return JSONPRequest;
    }());
    /* harmony default export */ var jsonp_request = (jsonp_request_JSONPRequest);

    // CONCATENATED MODULE: ./src/runtimes/web/timeline/jsonp_timeline.ts


    var getAgent = function (sender, useTLS) {
        return function (data, callback) {
            var scheme = 'http' + (useTLS ? 's' : '') + '://';
            var url = scheme + (sender.host || sender.options.host) + sender.options.path;
            var request = runtime.createJSONPRequest(url, data);
            var receiver = runtime.ScriptReceivers.create(function (error, result) {
                ScriptReceivers.remove(receiver);
                request.cleanup();
                if (result && result.host) {
                    sender.host = result.host;
                }
                if (callback) {
                    callback(error, result);
                }
            });
            request.send(receiver);
        };
    };
    var jsonp_timeline_jsonp = {
        name: 'jsonp',
        getAgent: getAgent
    };
    /* harmony default export */ var jsonp_timeline = (jsonp_timeline_jsonp);

    // CONCATENATED MODULE: ./src/core/transports/url_schemes.ts

    function getGenericURL(baseScheme, params, path) {
        var scheme = baseScheme + (params.useTLS ? 's' : '');
        var host = params.useTLS ? params.hostTLS : params.hostNonTLS;
        return scheme + '://' + host + path;
    }
    function getGenericPath(key, queryString) {
        var path = '/app/' + key;
        var query = '?protocol=' +
            defaults.PROTOCOL +
            '&client=js' +
            '&version=' +
            defaults.VERSION +
            (queryString ? '&' + queryString : '');
        return path + query;
    }
    var ws = {
        getInitial: function (key, params) {
            var path = (params.httpPath || '') + getGenericPath(key, 'flash=false');
            return getGenericURL('ws', params, path);
        }
    };
    var http = {
        getInitial: function (key, params) {
            var path = (params.httpPath || '/pusher') + getGenericPath(key);
            return getGenericURL('http', params, path);
        }
    };
    var sockjs = {
        getInitial: function (key, params) {
            return getGenericURL('http', params, params.httpPath || '/pusher');
        },
        getPath: function (key, params) {
            return getGenericPath(key);
        }
    };

    // CONCATENATED MODULE: ./src/core/events/callback_registry.ts

    var callback_registry_CallbackRegistry = (function () {
        function CallbackRegistry() {
            this._callbacks = {};
        }
        CallbackRegistry.prototype.get = function (name) {
            return this._callbacks[prefix(name)];
        };
        CallbackRegistry.prototype.add = function (name, callback, context) {
            var prefixedEventName = prefix(name);
            this._callbacks[prefixedEventName] =
                this._callbacks[prefixedEventName] || [];
            this._callbacks[prefixedEventName].push({
                fn: callback,
                context: context
            });
        };
        CallbackRegistry.prototype.remove = function (name, callback, context) {
            if (!name && !callback && !context) {
                this._callbacks = {};
                return;
            }
            var names = name ? [prefix(name)] : keys(this._callbacks);
            if (callback || context) {
                this.removeCallback(names, callback, context);
            }
            else {
                this.removeAllCallbacks(names);
            }
        };
        CallbackRegistry.prototype.removeCallback = function (names, callback, context) {
            apply(names, function (name) {
                this._callbacks[name] = filter(this._callbacks[name] || [], function (binding) {
                    return ((callback && callback !== binding.fn) ||
                        (context && context !== binding.context));
                });
                if (this._callbacks[name].length === 0) {
                    delete this._callbacks[name];
                }
            }, this);
        };
        CallbackRegistry.prototype.removeAllCallbacks = function (names) {
            apply(names, function (name) {
                delete this._callbacks[name];
            }, this);
        };
        return CallbackRegistry;
    }());
    /* harmony default export */ var callback_registry = (callback_registry_CallbackRegistry);
    function prefix(name) {
        return '_' + name;
    }

    // CONCATENATED MODULE: ./src/core/events/dispatcher.ts


    var dispatcher_Dispatcher = (function () {
        function Dispatcher(failThrough) {
            this.callbacks = new callback_registry();
            this.global_callbacks = [];
            this.failThrough = failThrough;
        }
        Dispatcher.prototype.bind = function (eventName, callback, context) {
            this.callbacks.add(eventName, callback, context);
            return this;
        };
        Dispatcher.prototype.bind_global = function (callback) {
            this.global_callbacks.push(callback);
            return this;
        };
        Dispatcher.prototype.unbind = function (eventName, callback, context) {
            this.callbacks.remove(eventName, callback, context);
            return this;
        };
        Dispatcher.prototype.unbind_global = function (callback) {
            if (!callback) {
                this.global_callbacks = [];
                return this;
            }
            this.global_callbacks = filter(this.global_callbacks || [], function (c) { return c !== callback; });
            return this;
        };
        Dispatcher.prototype.unbind_all = function () {
            this.unbind();
            this.unbind_global();
            return this;
        };
        Dispatcher.prototype.emit = function (eventName, data, metadata) {
            for (var i = 0; i < this.global_callbacks.length; i++) {
                this.global_callbacks[i](eventName, data);
            }
            var callbacks = this.callbacks.get(eventName);
            var args = [];
            if (metadata) {
                args.push(data, metadata);
            }
            else if (data) {
                args.push(data);
            }
            if (callbacks && callbacks.length > 0) {
                for (var i = 0; i < callbacks.length; i++) {
                    callbacks[i].fn.apply(callbacks[i].context || window, args);
                }
            }
            else if (this.failThrough) {
                this.failThrough(eventName, data);
            }
            return this;
        };
        return Dispatcher;
    }());
    /* harmony default export */ var dispatcher = (dispatcher_Dispatcher);

    // CONCATENATED MODULE: ./src/core/transports/transport_connection.ts
    var transport_connection_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var transport_connection_TransportConnection = (function (_super) {
        transport_connection_extends(TransportConnection, _super);
        function TransportConnection(hooks, name, priority, key, options) {
            var _this = _super.call(this) || this;
            _this.initialize = runtime.transportConnectionInitializer;
            _this.hooks = hooks;
            _this.name = name;
            _this.priority = priority;
            _this.key = key;
            _this.options = options;
            _this.state = 'new';
            _this.timeline = options.timeline;
            _this.activityTimeout = options.activityTimeout;
            _this.id = _this.timeline.generateUniqueID();
            return _this;
        }
        TransportConnection.prototype.handlesActivityChecks = function () {
            return Boolean(this.hooks.handlesActivityChecks);
        };
        TransportConnection.prototype.supportsPing = function () {
            return Boolean(this.hooks.supportsPing);
        };
        TransportConnection.prototype.connect = function () {
            var _this = this;
            if (this.socket || this.state !== 'initialized') {
                return false;
            }
            var url = this.hooks.urls.getInitial(this.key, this.options);
            try {
                this.socket = this.hooks.getSocket(url, this.options);
            }
            catch (e) {
                util.defer(function () {
                    _this.onError(e);
                    _this.changeState('closed');
                });
                return false;
            }
            this.bindListeners();
            logger.debug('Connecting', { transport: this.name, url: url });
            this.changeState('connecting');
            return true;
        };
        TransportConnection.prototype.close = function () {
            if (this.socket) {
                this.socket.close();
                return true;
            }
            else {
                return false;
            }
        };
        TransportConnection.prototype.send = function (data) {
            var _this = this;
            if (this.state === 'open') {
                util.defer(function () {
                    if (_this.socket) {
                        _this.socket.send(data);
                    }
                });
                return true;
            }
            else {
                return false;
            }
        };
        TransportConnection.prototype.ping = function () {
            if (this.state === 'open' && this.supportsPing()) {
                this.socket.ping();
            }
        };
        TransportConnection.prototype.onOpen = function () {
            if (this.hooks.beforeOpen) {
                this.hooks.beforeOpen(this.socket, this.hooks.urls.getPath(this.key, this.options));
            }
            this.changeState('open');
            this.socket.onopen = undefined;
        };
        TransportConnection.prototype.onError = function (error) {
            this.emit('error', { type: 'WebSocketError', error: error });
            this.timeline.error(this.buildTimelineMessage({ error: error.toString() }));
        };
        TransportConnection.prototype.onClose = function (closeEvent) {
            if (closeEvent) {
                this.changeState('closed', {
                    code: closeEvent.code,
                    reason: closeEvent.reason,
                    wasClean: closeEvent.wasClean
                });
            }
            else {
                this.changeState('closed');
            }
            this.unbindListeners();
            this.socket = undefined;
        };
        TransportConnection.prototype.onMessage = function (message) {
            this.emit('message', message);
        };
        TransportConnection.prototype.onActivity = function () {
            this.emit('activity');
        };
        TransportConnection.prototype.bindListeners = function () {
            var _this = this;
            this.socket.onopen = function () {
                _this.onOpen();
            };
            this.socket.onerror = function (error) {
                _this.onError(error);
            };
            this.socket.onclose = function (closeEvent) {
                _this.onClose(closeEvent);
            };
            this.socket.onmessage = function (message) {
                _this.onMessage(message);
            };
            if (this.supportsPing()) {
                this.socket.onactivity = function () {
                    _this.onActivity();
                };
            }
        };
        TransportConnection.prototype.unbindListeners = function () {
            if (this.socket) {
                this.socket.onopen = undefined;
                this.socket.onerror = undefined;
                this.socket.onclose = undefined;
                this.socket.onmessage = undefined;
                if (this.supportsPing()) {
                    this.socket.onactivity = undefined;
                }
            }
        };
        TransportConnection.prototype.changeState = function (state, params) {
            this.state = state;
            this.timeline.info(this.buildTimelineMessage({
                state: state,
                params: params
            }));
            this.emit(state, params);
        };
        TransportConnection.prototype.buildTimelineMessage = function (message) {
            return extend({ cid: this.id }, message);
        };
        return TransportConnection;
    }(dispatcher));
    /* harmony default export */ var transport_connection = (transport_connection_TransportConnection);

    // CONCATENATED MODULE: ./src/core/transports/transport.ts

    var transport_Transport = (function () {
        function Transport(hooks) {
            this.hooks = hooks;
        }
        Transport.prototype.isSupported = function (environment) {
            return this.hooks.isSupported(environment);
        };
        Transport.prototype.createConnection = function (name, priority, key, options) {
            return new transport_connection(this.hooks, name, priority, key, options);
        };
        return Transport;
    }());
    /* harmony default export */ var transports_transport = (transport_Transport);

    // CONCATENATED MODULE: ./src/runtimes/isomorphic/transports/transports.ts




    var WSTransport = new transports_transport({
        urls: ws,
        handlesActivityChecks: false,
        supportsPing: false,
        isInitialized: function () {
            return Boolean(runtime.getWebSocketAPI());
        },
        isSupported: function () {
            return Boolean(runtime.getWebSocketAPI());
        },
        getSocket: function (url) {
            return runtime.createWebSocket(url);
        }
    });
    var httpConfiguration = {
        urls: http,
        handlesActivityChecks: false,
        supportsPing: true,
        isInitialized: function () {
            return true;
        }
    };
    var streamingConfiguration = extend({
        getSocket: function (url) {
            return runtime.HTTPFactory.createStreamingSocket(url);
        }
    }, httpConfiguration);
    var pollingConfiguration = extend({
        getSocket: function (url) {
            return runtime.HTTPFactory.createPollingSocket(url);
        }
    }, httpConfiguration);
    var xhrConfiguration = {
        isSupported: function () {
            return runtime.isXHRSupported();
        }
    };
    var XHRStreamingTransport = new transports_transport((extend({}, streamingConfiguration, xhrConfiguration)));
    var XHRPollingTransport = new transports_transport(extend({}, pollingConfiguration, xhrConfiguration));
    var Transports = {
        ws: WSTransport,
        xhr_streaming: XHRStreamingTransport,
        xhr_polling: XHRPollingTransport
    };
    /* harmony default export */ var transports = (Transports);

    // CONCATENATED MODULE: ./src/runtimes/web/transports/transports.ts






    var SockJSTransport = new transports_transport({
        file: 'sockjs',
        urls: sockjs,
        handlesActivityChecks: true,
        supportsPing: false,
        isSupported: function () {
            return true;
        },
        isInitialized: function () {
            return window.SockJS !== undefined;
        },
        getSocket: function (url, options) {
            return new window.SockJS(url, null, {
                js_path: Dependencies.getPath('sockjs', {
                    useTLS: options.useTLS
                }),
                ignore_null_origin: options.ignoreNullOrigin
            });
        },
        beforeOpen: function (socket, path) {
            socket.send(JSON.stringify({
                path: path
            }));
        }
    });
    var xdrConfiguration = {
        isSupported: function (environment) {
            var yes = runtime.isXDRSupported(environment.useTLS);
            return yes;
        }
    };
    var XDRStreamingTransport = new transports_transport((extend({}, streamingConfiguration, xdrConfiguration)));
    var XDRPollingTransport = new transports_transport(extend({}, pollingConfiguration, xdrConfiguration));
    transports.xdr_streaming = XDRStreamingTransport;
    transports.xdr_polling = XDRPollingTransport;
    transports.sockjs = SockJSTransport;
    /* harmony default export */ var transports_transports = (transports);

    // CONCATENATED MODULE: ./src/runtimes/web/net_info.ts
    var net_info_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();

    var NetInfo = (function (_super) {
        net_info_extends(NetInfo, _super);
        function NetInfo() {
            var _this = _super.call(this) || this;
            var self = _this;
            if (window.addEventListener !== undefined) {
                window.addEventListener('online', function () {
                    self.emit('online');
                }, false);
                window.addEventListener('offline', function () {
                    self.emit('offline');
                }, false);
            }
            return _this;
        }
        NetInfo.prototype.isOnline = function () {
            if (window.navigator.onLine === undefined) {
                return true;
            }
            else {
                return window.navigator.onLine;
            }
        };
        return NetInfo;
    }(dispatcher));

    var net_info_Network = new NetInfo();

    // CONCATENATED MODULE: ./src/core/transports/assistant_to_the_transport_manager.ts


    var assistant_to_the_transport_manager_AssistantToTheTransportManager = (function () {
        function AssistantToTheTransportManager(manager, transport, options) {
            this.manager = manager;
            this.transport = transport;
            this.minPingDelay = options.minPingDelay;
            this.maxPingDelay = options.maxPingDelay;
            this.pingDelay = undefined;
        }
        AssistantToTheTransportManager.prototype.createConnection = function (name, priority, key, options) {
            var _this = this;
            options = extend({}, options, {
                activityTimeout: this.pingDelay
            });
            var connection = this.transport.createConnection(name, priority, key, options);
            var openTimestamp = null;
            var onOpen = function () {
                connection.unbind('open', onOpen);
                connection.bind('closed', onClosed);
                openTimestamp = util.now();
            };
            var onClosed = function (closeEvent) {
                connection.unbind('closed', onClosed);
                if (closeEvent.code === 1002 || closeEvent.code === 1003) {
                    _this.manager.reportDeath();
                }
                else if (!closeEvent.wasClean && openTimestamp) {
                    var lifespan = util.now() - openTimestamp;
                    if (lifespan < 2 * _this.maxPingDelay) {
                        _this.manager.reportDeath();
                        _this.pingDelay = Math.max(lifespan / 2, _this.minPingDelay);
                    }
                }
            };
            connection.bind('open', onOpen);
            return connection;
        };
        AssistantToTheTransportManager.prototype.isSupported = function (environment) {
            return this.manager.isAlive() && this.transport.isSupported(environment);
        };
        return AssistantToTheTransportManager;
    }());
    /* harmony default export */ var assistant_to_the_transport_manager = (assistant_to_the_transport_manager_AssistantToTheTransportManager);

    // CONCATENATED MODULE: ./src/core/connection/protocol/protocol.ts
    var Protocol = {
        decodeMessage: function (messageEvent) {
            try {
                var messageData = JSON.parse(messageEvent.data);
                var pusherEventData = messageData.data;
                if (typeof pusherEventData === 'string') {
                    try {
                        pusherEventData = JSON.parse(messageData.data);
                    }
                    catch (e) { }
                }
                var pusherEvent = {
                    event: messageData.event,
                    channel: messageData.channel,
                    data: pusherEventData
                };
                if (messageData.user_id) {
                    pusherEvent.user_id = messageData.user_id;
                }
                return pusherEvent;
            }
            catch (e) {
                throw { type: 'MessageParseError', error: e, data: messageEvent.data };
            }
        },
        encodeMessage: function (event) {
            return JSON.stringify(event);
        },
        processHandshake: function (messageEvent) {
            var message = Protocol.decodeMessage(messageEvent);
            if (message.event === 'pusher:connection_established') {
                if (!message.data.activity_timeout) {
                    throw 'No activity timeout specified in handshake';
                }
                return {
                    action: 'connected',
                    id: message.data.socket_id,
                    activityTimeout: message.data.activity_timeout * 1000
                };
            }
            else if (message.event === 'pusher:error') {
                return {
                    action: this.getCloseAction(message.data),
                    error: this.getCloseError(message.data)
                };
            }
            else {
                throw 'Invalid handshake';
            }
        },
        getCloseAction: function (closeEvent) {
            if (closeEvent.code < 4000) {
                if (closeEvent.code >= 1002 && closeEvent.code <= 1004) {
                    return 'backoff';
                }
                else {
                    return null;
                }
            }
            else if (closeEvent.code === 4000) {
                return 'tls_only';
            }
            else if (closeEvent.code < 4100) {
                return 'refused';
            }
            else if (closeEvent.code < 4200) {
                return 'backoff';
            }
            else if (closeEvent.code < 4300) {
                return 'retry';
            }
            else {
                return 'refused';
            }
        },
        getCloseError: function (closeEvent) {
            if (closeEvent.code !== 1000 && closeEvent.code !== 1001) {
                return {
                    type: 'PusherError',
                    data: {
                        code: closeEvent.code,
                        message: closeEvent.reason || closeEvent.message
                    }
                };
            }
            else {
                return null;
            }
        }
    };
    /* harmony default export */ var protocol_protocol = (Protocol);

    // CONCATENATED MODULE: ./src/core/connection/connection.ts
    var connection_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();




    var connection_Connection = (function (_super) {
        connection_extends(Connection, _super);
        function Connection(id, transport) {
            var _this = _super.call(this) || this;
            _this.id = id;
            _this.transport = transport;
            _this.activityTimeout = transport.activityTimeout;
            _this.bindListeners();
            return _this;
        }
        Connection.prototype.handlesActivityChecks = function () {
            return this.transport.handlesActivityChecks();
        };
        Connection.prototype.send = function (data) {
            return this.transport.send(data);
        };
        Connection.prototype.send_event = function (name, data, channel) {
            var event = { event: name, data: data };
            if (channel) {
                event.channel = channel;
            }
            logger.debug('Event sent', event);
            return this.send(protocol_protocol.encodeMessage(event));
        };
        Connection.prototype.ping = function () {
            if (this.transport.supportsPing()) {
                this.transport.ping();
            }
            else {
                this.send_event('pusher:ping', {});
            }
        };
        Connection.prototype.close = function () {
            this.transport.close();
        };
        Connection.prototype.bindListeners = function () {
            var _this = this;
            var listeners = {
                message: function (messageEvent) {
                    var pusherEvent;
                    try {
                        pusherEvent = protocol_protocol.decodeMessage(messageEvent);
                    }
                    catch (e) {
                        _this.emit('error', {
                            type: 'MessageParseError',
                            error: e,
                            data: messageEvent.data
                        });
                    }
                    if (pusherEvent !== undefined) {
                        logger.debug('Event recd', pusherEvent);
                        switch (pusherEvent.event) {
                            case 'pusher:error':
                                _this.emit('error', {
                                    type: 'PusherError',
                                    data: pusherEvent.data
                                });
                                break;
                            case 'pusher:ping':
                                _this.emit('ping');
                                break;
                            case 'pusher:pong':
                                _this.emit('pong');
                                break;
                        }
                        _this.emit('message', pusherEvent);
                    }
                },
                activity: function () {
                    _this.emit('activity');
                },
                error: function (error) {
                    _this.emit('error', error);
                },
                closed: function (closeEvent) {
                    unbindListeners();
                    if (closeEvent && closeEvent.code) {
                        _this.handleCloseEvent(closeEvent);
                    }
                    _this.transport = null;
                    _this.emit('closed');
                }
            };
            var unbindListeners = function () {
                objectApply(listeners, function (listener, event) {
                    _this.transport.unbind(event, listener);
                });
            };
            objectApply(listeners, function (listener, event) {
                _this.transport.bind(event, listener);
            });
        };
        Connection.prototype.handleCloseEvent = function (closeEvent) {
            var action = protocol_protocol.getCloseAction(closeEvent);
            var error = protocol_protocol.getCloseError(closeEvent);
            if (error) {
                this.emit('error', error);
            }
            if (action) {
                this.emit(action, { action: action, error: error });
            }
        };
        return Connection;
    }(dispatcher));
    /* harmony default export */ var connection_connection = (connection_Connection);

    // CONCATENATED MODULE: ./src/core/connection/handshake/index.ts



    var handshake_Handshake = (function () {
        function Handshake(transport, callback) {
            this.transport = transport;
            this.callback = callback;
            this.bindListeners();
        }
        Handshake.prototype.close = function () {
            this.unbindListeners();
            this.transport.close();
        };
        Handshake.prototype.bindListeners = function () {
            var _this = this;
            this.onMessage = function (m) {
                _this.unbindListeners();
                var result;
                try {
                    result = protocol_protocol.processHandshake(m);
                }
                catch (e) {
                    _this.finish('error', { error: e });
                    _this.transport.close();
                    return;
                }
                if (result.action === 'connected') {
                    _this.finish('connected', {
                        connection: new connection_connection(result.id, _this.transport),
                        activityTimeout: result.activityTimeout
                    });
                }
                else {
                    _this.finish(result.action, { error: result.error });
                    _this.transport.close();
                }
            };
            this.onClosed = function (closeEvent) {
                _this.unbindListeners();
                var action = protocol_protocol.getCloseAction(closeEvent) || 'backoff';
                var error = protocol_protocol.getCloseError(closeEvent);
                _this.finish(action, { error: error });
            };
            this.transport.bind('message', this.onMessage);
            this.transport.bind('closed', this.onClosed);
        };
        Handshake.prototype.unbindListeners = function () {
            this.transport.unbind('message', this.onMessage);
            this.transport.unbind('closed', this.onClosed);
        };
        Handshake.prototype.finish = function (action, params) {
            this.callback(extend({ transport: this.transport, action: action }, params));
        };
        return Handshake;
    }());
    /* harmony default export */ var connection_handshake = (handshake_Handshake);

    // CONCATENATED MODULE: ./src/core/timeline/timeline_sender.ts

    var timeline_sender_TimelineSender = (function () {
        function TimelineSender(timeline, options) {
            this.timeline = timeline;
            this.options = options || {};
        }
        TimelineSender.prototype.send = function (useTLS, callback) {
            if (this.timeline.isEmpty()) {
                return;
            }
            this.timeline.send(runtime.TimelineTransport.getAgent(this, useTLS), callback);
        };
        return TimelineSender;
    }());
    /* harmony default export */ var timeline_sender = (timeline_sender_TimelineSender);

    // CONCATENATED MODULE: ./src/core/channels/channel.ts
    var channel_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var channel_Channel = (function (_super) {
        channel_extends(Channel, _super);
        function Channel(name, pusher) {
            var _this = _super.call(this, function (event, data) {
                logger.debug('No callbacks on ' + name + ' for ' + event);
            }) || this;
            _this.name = name;
            _this.pusher = pusher;
            _this.subscribed = false;
            _this.subscriptionPending = false;
            _this.subscriptionCancelled = false;
            return _this;
        }
        Channel.prototype.authorize = function (socketId, callback) {
            return callback(null, { auth: '' });
        };
        Channel.prototype.trigger = function (event, data) {
            if (event.indexOf('client-') !== 0) {
                throw new BadEventName("Event '" + event + "' does not start with 'client-'");
            }
            if (!this.subscribed) {
                var suffix = url_store.buildLogSuffix('triggeringClientEvents');
                logger.warn("Client event triggered before channel 'subscription_succeeded' event . " + suffix);
            }
            return this.pusher.send_event(event, data, this.name);
        };
        Channel.prototype.disconnect = function () {
            this.subscribed = false;
            this.subscriptionPending = false;
        };
        Channel.prototype.handleEvent = function (event) {
            var eventName = event.event;
            var data = event.data;
            if (eventName === 'pusher_internal:subscription_succeeded') {
                this.handleSubscriptionSucceededEvent(event);
            }
            else if (eventName === 'pusher_internal:subscription_count') {
                this.handleSubscriptionCountEvent(event);
            }
            else if (eventName.indexOf('pusher_internal:') !== 0) {
                var metadata = {};
                this.emit(eventName, data, metadata);
            }
        };
        Channel.prototype.handleSubscriptionSucceededEvent = function (event) {
            this.subscriptionPending = false;
            this.subscribed = true;
            if (this.subscriptionCancelled) {
                this.pusher.unsubscribe(this.name);
            }
            else {
                this.emit('pusher:subscription_succeeded', event.data);
            }
        };
        Channel.prototype.handleSubscriptionCountEvent = function (event) {
            if (event.data.subscription_count) {
                this.subscriptionCount = event.data.subscription_count;
            }
            this.emit('pusher:subscription_count', event.data);
        };
        Channel.prototype.subscribe = function () {
            var _this = this;
            if (this.subscribed) {
                return;
            }
            this.subscriptionPending = true;
            this.subscriptionCancelled = false;
            this.authorize(this.pusher.connection.socket_id, function (error, data) {
                if (error) {
                    _this.subscriptionPending = false;
                    logger.error(error.toString());
                    _this.emit('pusher:subscription_error', Object.assign({}, {
                        type: 'AuthError',
                        error: error.message
                    }, error instanceof HTTPAuthError ? { status: error.status } : {}));
                }
                else {
                    _this.pusher.send_event('pusher:subscribe', {
                        auth: data.auth,
                        channel_data: data.channel_data,
                        channel: _this.name
                    });
                }
            });
        };
        Channel.prototype.unsubscribe = function () {
            this.subscribed = false;
            this.pusher.send_event('pusher:unsubscribe', {
                channel: this.name
            });
        };
        Channel.prototype.cancelSubscription = function () {
            this.subscriptionCancelled = true;
        };
        Channel.prototype.reinstateSubscription = function () {
            this.subscriptionCancelled = false;
        };
        return Channel;
    }(dispatcher));
    /* harmony default export */ var channels_channel = (channel_Channel);

    // CONCATENATED MODULE: ./src/core/channels/private_channel.ts
    var private_channel_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();

    var PrivateChannel = (function (_super) {
        private_channel_extends(PrivateChannel, _super);
        function PrivateChannel() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        PrivateChannel.prototype.authorize = function (socketId, callback) {
            return this.pusher.config.channelAuthorizer({
                channelName: this.name,
                socketId: socketId
            }, callback);
        };
        return PrivateChannel;
    }(channels_channel));
    /* harmony default export */ var private_channel = (PrivateChannel);

    // CONCATENATED MODULE: ./src/core/channels/members.ts

    var members_Members = (function () {
        function Members() {
            this.reset();
        }
        Members.prototype.get = function (id) {
            if (Object.prototype.hasOwnProperty.call(this.members, id)) {
                return {
                    id: id,
                    info: this.members[id]
                };
            }
            else {
                return null;
            }
        };
        Members.prototype.each = function (callback) {
            var _this = this;
            objectApply(this.members, function (member, id) {
                callback(_this.get(id));
            });
        };
        Members.prototype.setMyID = function (id) {
            this.myID = id;
        };
        Members.prototype.onSubscription = function (subscriptionData) {
            this.members = subscriptionData.presence.hash;
            this.count = subscriptionData.presence.count;
            this.me = this.get(this.myID);
        };
        Members.prototype.addMember = function (memberData) {
            if (this.get(memberData.user_id) === null) {
                this.count++;
            }
            this.members[memberData.user_id] = memberData.user_info;
            return this.get(memberData.user_id);
        };
        Members.prototype.removeMember = function (memberData) {
            var member = this.get(memberData.user_id);
            if (member) {
                delete this.members[memberData.user_id];
                this.count--;
            }
            return member;
        };
        Members.prototype.reset = function () {
            this.members = {};
            this.count = 0;
            this.myID = null;
            this.me = null;
        };
        return Members;
    }());
    /* harmony default export */ var members = (members_Members);

    // CONCATENATED MODULE: ./src/core/channels/presence_channel.ts
    var presence_channel_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var __awaiter = function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var __generator = function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };




    var presence_channel_PresenceChannel = (function (_super) {
        presence_channel_extends(PresenceChannel, _super);
        function PresenceChannel(name, pusher) {
            var _this = _super.call(this, name, pusher) || this;
            _this.members = new members();
            return _this;
        }
        PresenceChannel.prototype.authorize = function (socketId, callback) {
            var _this = this;
            _super.prototype.authorize.call(this, socketId, function (error, authData) { return __awaiter(_this, void 0, void 0, function () {
                var channelData, suffix;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!error) return [3, 3];
                            authData = authData;
                            if (!(authData.channel_data != null)) return [3, 1];
                            channelData = JSON.parse(authData.channel_data);
                            this.members.setMyID(channelData.user_id);
                            return [3, 3];
                        case 1: return [4, this.pusher.user.signinDonePromise];
                        case 2:
                            _a.sent();
                            if (this.pusher.user.user_data != null) {
                                this.members.setMyID(this.pusher.user.user_data.id);
                            }
                            else {
                                suffix = url_store.buildLogSuffix('authorizationEndpoint');
                                logger.error("Invalid auth response for channel '" + this.name + "', " +
                                    ("expected 'channel_data' field. " + suffix + ", ") +
                                    "or the user should be signed in.");
                                callback('Invalid auth response');
                                return [2];
                            }
                            _a.label = 3;
                        case 3:
                            callback(error, authData);
                            return [2];
                    }
                });
            }); });
        };
        PresenceChannel.prototype.handleEvent = function (event) {
            var eventName = event.event;
            if (eventName.indexOf('pusher_internal:') === 0) {
                this.handleInternalEvent(event);
            }
            else {
                var data = event.data;
                var metadata = {};
                if (event.user_id) {
                    metadata.user_id = event.user_id;
                }
                this.emit(eventName, data, metadata);
            }
        };
        PresenceChannel.prototype.handleInternalEvent = function (event) {
            var eventName = event.event;
            var data = event.data;
            switch (eventName) {
                case 'pusher_internal:subscription_succeeded':
                    this.handleSubscriptionSucceededEvent(event);
                    break;
                case 'pusher_internal:subscription_count':
                    this.handleSubscriptionCountEvent(event);
                    break;
                case 'pusher_internal:member_added':
                    var addedMember = this.members.addMember(data);
                    this.emit('pusher:member_added', addedMember);
                    break;
                case 'pusher_internal:member_removed':
                    var removedMember = this.members.removeMember(data);
                    if (removedMember) {
                        this.emit('pusher:member_removed', removedMember);
                    }
                    break;
            }
        };
        PresenceChannel.prototype.handleSubscriptionSucceededEvent = function (event) {
            this.subscriptionPending = false;
            this.subscribed = true;
            if (this.subscriptionCancelled) {
                this.pusher.unsubscribe(this.name);
            }
            else {
                this.members.onSubscription(event.data);
                this.emit('pusher:subscription_succeeded', this.members);
            }
        };
        PresenceChannel.prototype.disconnect = function () {
            this.members.reset();
            _super.prototype.disconnect.call(this);
        };
        return PresenceChannel;
    }(private_channel));
    /* harmony default export */ var presence_channel = (presence_channel_PresenceChannel);

    // EXTERNAL MODULE: ./node_modules/@stablelib/utf8/lib/utf8.js
    var utf8 = __webpack_require__(1);

    // EXTERNAL MODULE: ./node_modules/@stablelib/base64/lib/base64.js
    var base64 = __webpack_require__(0);

    // CONCATENATED MODULE: ./src/core/channels/encrypted_channel.ts
    var encrypted_channel_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var encrypted_channel_EncryptedChannel = (function (_super) {
        encrypted_channel_extends(EncryptedChannel, _super);
        function EncryptedChannel(name, pusher, nacl) {
            var _this = _super.call(this, name, pusher) || this;
            _this.key = null;
            _this.nacl = nacl;
            return _this;
        }
        EncryptedChannel.prototype.authorize = function (socketId, callback) {
            var _this = this;
            _super.prototype.authorize.call(this, socketId, function (error, authData) {
                if (error) {
                    callback(error, authData);
                    return;
                }
                var sharedSecret = authData['shared_secret'];
                if (!sharedSecret) {
                    callback(new Error("No shared_secret key in auth payload for encrypted channel: " + _this.name), null);
                    return;
                }
                _this.key = Object(base64["decode"])(sharedSecret);
                delete authData['shared_secret'];
                callback(null, authData);
            });
        };
        EncryptedChannel.prototype.trigger = function (event, data) {
            throw new UnsupportedFeature('Client events are not currently supported for encrypted channels');
        };
        EncryptedChannel.prototype.handleEvent = function (event) {
            var eventName = event.event;
            var data = event.data;
            if (eventName.indexOf('pusher_internal:') === 0 ||
                eventName.indexOf('pusher:') === 0) {
                _super.prototype.handleEvent.call(this, event);
                return;
            }
            this.handleEncryptedEvent(eventName, data);
        };
        EncryptedChannel.prototype.handleEncryptedEvent = function (event, data) {
            var _this = this;
            if (!this.key) {
                logger.debug('Received encrypted event before key has been retrieved from the authEndpoint');
                return;
            }
            if (!data.ciphertext || !data.nonce) {
                logger.error('Unexpected format for encrypted event, expected object with `ciphertext` and `nonce` fields, got: ' +
                    data);
                return;
            }
            var cipherText = Object(base64["decode"])(data.ciphertext);
            if (cipherText.length < this.nacl.secretbox.overheadLength) {
                logger.error("Expected encrypted event ciphertext length to be " + this.nacl.secretbox.overheadLength + ", got: " + cipherText.length);
                return;
            }
            var nonce = Object(base64["decode"])(data.nonce);
            if (nonce.length < this.nacl.secretbox.nonceLength) {
                logger.error("Expected encrypted event nonce length to be " + this.nacl.secretbox.nonceLength + ", got: " + nonce.length);
                return;
            }
            var bytes = this.nacl.secretbox.open(cipherText, nonce, this.key);
            if (bytes === null) {
                logger.debug('Failed to decrypt an event, probably because it was encrypted with a different key. Fetching a new key from the authEndpoint...');
                this.authorize(this.pusher.connection.socket_id, function (error, authData) {
                    if (error) {
                        logger.error("Failed to make a request to the authEndpoint: " + authData + ". Unable to fetch new key, so dropping encrypted event");
                        return;
                    }
                    bytes = _this.nacl.secretbox.open(cipherText, nonce, _this.key);
                    if (bytes === null) {
                        logger.error("Failed to decrypt event with new key. Dropping encrypted event");
                        return;
                    }
                    _this.emit(event, _this.getDataToEmit(bytes));
                    return;
                });
                return;
            }
            this.emit(event, this.getDataToEmit(bytes));
        };
        EncryptedChannel.prototype.getDataToEmit = function (bytes) {
            var raw = Object(utf8["decode"])(bytes);
            try {
                return JSON.parse(raw);
            }
            catch (_a) {
                return raw;
            }
        };
        return EncryptedChannel;
    }(private_channel));
    /* harmony default export */ var encrypted_channel = (encrypted_channel_EncryptedChannel);

    // CONCATENATED MODULE: ./src/core/connection/connection_manager.ts
    var connection_manager_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var connection_manager_ConnectionManager = (function (_super) {
        connection_manager_extends(ConnectionManager, _super);
        function ConnectionManager(key, options) {
            var _this = _super.call(this) || this;
            _this.state = 'initialized';
            _this.connection = null;
            _this.key = key;
            _this.options = options;
            _this.timeline = _this.options.timeline;
            _this.usingTLS = _this.options.useTLS;
            _this.errorCallbacks = _this.buildErrorCallbacks();
            _this.connectionCallbacks = _this.buildConnectionCallbacks(_this.errorCallbacks);
            _this.handshakeCallbacks = _this.buildHandshakeCallbacks(_this.errorCallbacks);
            var Network = runtime.getNetwork();
            Network.bind('online', function () {
                _this.timeline.info({ netinfo: 'online' });
                if (_this.state === 'connecting' || _this.state === 'unavailable') {
                    _this.retryIn(0);
                }
            });
            Network.bind('offline', function () {
                _this.timeline.info({ netinfo: 'offline' });
                if (_this.connection) {
                    _this.sendActivityCheck();
                }
            });
            _this.updateStrategy();
            return _this;
        }
        ConnectionManager.prototype.connect = function () {
            if (this.connection || this.runner) {
                return;
            }
            if (!this.strategy.isSupported()) {
                this.updateState('failed');
                return;
            }
            this.updateState('connecting');
            this.startConnecting();
            this.setUnavailableTimer();
        };
        ConnectionManager.prototype.send = function (data) {
            if (this.connection) {
                return this.connection.send(data);
            }
            else {
                return false;
            }
        };
        ConnectionManager.prototype.send_event = function (name, data, channel) {
            if (this.connection) {
                return this.connection.send_event(name, data, channel);
            }
            else {
                return false;
            }
        };
        ConnectionManager.prototype.disconnect = function () {
            this.disconnectInternally();
            this.updateState('disconnected');
        };
        ConnectionManager.prototype.isUsingTLS = function () {
            return this.usingTLS;
        };
        ConnectionManager.prototype.startConnecting = function () {
            var _this = this;
            var callback = function (error, handshake) {
                if (error) {
                    _this.runner = _this.strategy.connect(0, callback);
                }
                else {
                    if (handshake.action === 'error') {
                        _this.emit('error', {
                            type: 'HandshakeError',
                            error: handshake.error
                        });
                        _this.timeline.error({ handshakeError: handshake.error });
                    }
                    else {
                        _this.abortConnecting();
                        _this.handshakeCallbacks[handshake.action](handshake);
                    }
                }
            };
            this.runner = this.strategy.connect(0, callback);
        };
        ConnectionManager.prototype.abortConnecting = function () {
            if (this.runner) {
                this.runner.abort();
                this.runner = null;
            }
        };
        ConnectionManager.prototype.disconnectInternally = function () {
            this.abortConnecting();
            this.clearRetryTimer();
            this.clearUnavailableTimer();
            if (this.connection) {
                var connection = this.abandonConnection();
                connection.close();
            }
        };
        ConnectionManager.prototype.updateStrategy = function () {
            this.strategy = this.options.getStrategy({
                key: this.key,
                timeline: this.timeline,
                useTLS: this.usingTLS
            });
        };
        ConnectionManager.prototype.retryIn = function (delay) {
            var _this = this;
            this.timeline.info({ action: 'retry', delay: delay });
            if (delay > 0) {
                this.emit('connecting_in', Math.round(delay / 1000));
            }
            this.retryTimer = new OneOffTimer(delay || 0, function () {
                _this.disconnectInternally();
                _this.connect();
            });
        };
        ConnectionManager.prototype.clearRetryTimer = function () {
            if (this.retryTimer) {
                this.retryTimer.ensureAborted();
                this.retryTimer = null;
            }
        };
        ConnectionManager.prototype.setUnavailableTimer = function () {
            var _this = this;
            this.unavailableTimer = new OneOffTimer(this.options.unavailableTimeout, function () {
                _this.updateState('unavailable');
            });
        };
        ConnectionManager.prototype.clearUnavailableTimer = function () {
            if (this.unavailableTimer) {
                this.unavailableTimer.ensureAborted();
            }
        };
        ConnectionManager.prototype.sendActivityCheck = function () {
            var _this = this;
            this.stopActivityCheck();
            this.connection.ping();
            this.activityTimer = new OneOffTimer(this.options.pongTimeout, function () {
                _this.timeline.error({ pong_timed_out: _this.options.pongTimeout });
                _this.retryIn(0);
            });
        };
        ConnectionManager.prototype.resetActivityCheck = function () {
            var _this = this;
            this.stopActivityCheck();
            if (this.connection && !this.connection.handlesActivityChecks()) {
                this.activityTimer = new OneOffTimer(this.activityTimeout, function () {
                    _this.sendActivityCheck();
                });
            }
        };
        ConnectionManager.prototype.stopActivityCheck = function () {
            if (this.activityTimer) {
                this.activityTimer.ensureAborted();
            }
        };
        ConnectionManager.prototype.buildConnectionCallbacks = function (errorCallbacks) {
            var _this = this;
            return extend({}, errorCallbacks, {
                message: function (message) {
                    _this.resetActivityCheck();
                    _this.emit('message', message);
                },
                ping: function () {
                    _this.send_event('pusher:pong', {});
                },
                activity: function () {
                    _this.resetActivityCheck();
                },
                error: function (error) {
                    _this.emit('error', error);
                },
                closed: function () {
                    _this.abandonConnection();
                    if (_this.shouldRetry()) {
                        _this.retryIn(1000);
                    }
                }
            });
        };
        ConnectionManager.prototype.buildHandshakeCallbacks = function (errorCallbacks) {
            var _this = this;
            return extend({}, errorCallbacks, {
                connected: function (handshake) {
                    _this.activityTimeout = Math.min(_this.options.activityTimeout, handshake.activityTimeout, handshake.connection.activityTimeout || Infinity);
                    _this.clearUnavailableTimer();
                    _this.setConnection(handshake.connection);
                    _this.socket_id = _this.connection.id;
                    _this.updateState('connected', { socket_id: _this.socket_id });
                }
            });
        };
        ConnectionManager.prototype.buildErrorCallbacks = function () {
            var _this = this;
            var withErrorEmitted = function (callback) {
                return function (result) {
                    if (result.error) {
                        _this.emit('error', { type: 'WebSocketError', error: result.error });
                    }
                    callback(result);
                };
            };
            return {
                tls_only: withErrorEmitted(function () {
                    _this.usingTLS = true;
                    _this.updateStrategy();
                    _this.retryIn(0);
                }),
                refused: withErrorEmitted(function () {
                    _this.disconnect();
                }),
                backoff: withErrorEmitted(function () {
                    _this.retryIn(1000);
                }),
                retry: withErrorEmitted(function () {
                    _this.retryIn(0);
                })
            };
        };
        ConnectionManager.prototype.setConnection = function (connection) {
            this.connection = connection;
            for (var event in this.connectionCallbacks) {
                this.connection.bind(event, this.connectionCallbacks[event]);
            }
            this.resetActivityCheck();
        };
        ConnectionManager.prototype.abandonConnection = function () {
            if (!this.connection) {
                return;
            }
            this.stopActivityCheck();
            for (var event in this.connectionCallbacks) {
                this.connection.unbind(event, this.connectionCallbacks[event]);
            }
            var connection = this.connection;
            this.connection = null;
            return connection;
        };
        ConnectionManager.prototype.updateState = function (newState, data) {
            var previousState = this.state;
            this.state = newState;
            if (previousState !== newState) {
                var newStateDescription = newState;
                if (newStateDescription === 'connected') {
                    newStateDescription += ' with new socket ID ' + data.socket_id;
                }
                logger.debug('State changed', previousState + ' -> ' + newStateDescription);
                this.timeline.info({ state: newState, params: data });
                this.emit('state_change', { previous: previousState, current: newState });
                this.emit(newState, data);
            }
        };
        ConnectionManager.prototype.shouldRetry = function () {
            return this.state === 'connecting' || this.state === 'connected';
        };
        return ConnectionManager;
    }(dispatcher));
    /* harmony default export */ var connection_manager = (connection_manager_ConnectionManager);

    // CONCATENATED MODULE: ./src/core/channels/channels.ts




    var channels_Channels = (function () {
        function Channels() {
            this.channels = {};
        }
        Channels.prototype.add = function (name, pusher) {
            if (!this.channels[name]) {
                this.channels[name] = createChannel(name, pusher);
            }
            return this.channels[name];
        };
        Channels.prototype.all = function () {
            return values(this.channels);
        };
        Channels.prototype.find = function (name) {
            return this.channels[name];
        };
        Channels.prototype.remove = function (name) {
            var channel = this.channels[name];
            delete this.channels[name];
            return channel;
        };
        Channels.prototype.disconnect = function () {
            objectApply(this.channels, function (channel) {
                channel.disconnect();
            });
        };
        return Channels;
    }());
    /* harmony default export */ var channels = (channels_Channels);
    function createChannel(name, pusher) {
        if (name.indexOf('private-encrypted-') === 0) {
            if (pusher.config.nacl) {
                return factory.createEncryptedChannel(name, pusher, pusher.config.nacl);
            }
            var errMsg = 'Tried to subscribe to a private-encrypted- channel but no nacl implementation available';
            var suffix = url_store.buildLogSuffix('encryptedChannelSupport');
            throw new UnsupportedFeature(errMsg + ". " + suffix);
        }
        else if (name.indexOf('private-') === 0) {
            return factory.createPrivateChannel(name, pusher);
        }
        else if (name.indexOf('presence-') === 0) {
            return factory.createPresenceChannel(name, pusher);
        }
        else if (name.indexOf('#') === 0) {
            throw new BadChannelName('Cannot create a channel with name "' + name + '".');
        }
        else {
            return factory.createChannel(name, pusher);
        }
    }

    // CONCATENATED MODULE: ./src/core/utils/factory.ts









    var Factory = {
        createChannels: function () {
            return new channels();
        },
        createConnectionManager: function (key, options) {
            return new connection_manager(key, options);
        },
        createChannel: function (name, pusher) {
            return new channels_channel(name, pusher);
        },
        createPrivateChannel: function (name, pusher) {
            return new private_channel(name, pusher);
        },
        createPresenceChannel: function (name, pusher) {
            return new presence_channel(name, pusher);
        },
        createEncryptedChannel: function (name, pusher, nacl) {
            return new encrypted_channel(name, pusher, nacl);
        },
        createTimelineSender: function (timeline, options) {
            return new timeline_sender(timeline, options);
        },
        createHandshake: function (transport, callback) {
            return new connection_handshake(transport, callback);
        },
        createAssistantToTheTransportManager: function (manager, transport, options) {
            return new assistant_to_the_transport_manager(manager, transport, options);
        }
    };
    /* harmony default export */ var factory = (Factory);

    // CONCATENATED MODULE: ./src/core/transports/transport_manager.ts

    var transport_manager_TransportManager = (function () {
        function TransportManager(options) {
            this.options = options || {};
            this.livesLeft = this.options.lives || Infinity;
        }
        TransportManager.prototype.getAssistant = function (transport) {
            return factory.createAssistantToTheTransportManager(this, transport, {
                minPingDelay: this.options.minPingDelay,
                maxPingDelay: this.options.maxPingDelay
            });
        };
        TransportManager.prototype.isAlive = function () {
            return this.livesLeft > 0;
        };
        TransportManager.prototype.reportDeath = function () {
            this.livesLeft -= 1;
        };
        return TransportManager;
    }());
    /* harmony default export */ var transport_manager = (transport_manager_TransportManager);

    // CONCATENATED MODULE: ./src/core/strategies/sequential_strategy.ts



    var sequential_strategy_SequentialStrategy = (function () {
        function SequentialStrategy(strategies, options) {
            this.strategies = strategies;
            this.loop = Boolean(options.loop);
            this.failFast = Boolean(options.failFast);
            this.timeout = options.timeout;
            this.timeoutLimit = options.timeoutLimit;
        }
        SequentialStrategy.prototype.isSupported = function () {
            return any(this.strategies, util.method('isSupported'));
        };
        SequentialStrategy.prototype.connect = function (minPriority, callback) {
            var _this = this;
            var strategies = this.strategies;
            var current = 0;
            var timeout = this.timeout;
            var runner = null;
            var tryNextStrategy = function (error, handshake) {
                if (handshake) {
                    callback(null, handshake);
                }
                else {
                    current = current + 1;
                    if (_this.loop) {
                        current = current % strategies.length;
                    }
                    if (current < strategies.length) {
                        if (timeout) {
                            timeout = timeout * 2;
                            if (_this.timeoutLimit) {
                                timeout = Math.min(timeout, _this.timeoutLimit);
                            }
                        }
                        runner = _this.tryStrategy(strategies[current], minPriority, { timeout: timeout, failFast: _this.failFast }, tryNextStrategy);
                    }
                    else {
                        callback(true);
                    }
                }
            };
            runner = this.tryStrategy(strategies[current], minPriority, { timeout: timeout, failFast: this.failFast }, tryNextStrategy);
            return {
                abort: function () {
                    runner.abort();
                },
                forceMinPriority: function (p) {
                    minPriority = p;
                    if (runner) {
                        runner.forceMinPriority(p);
                    }
                }
            };
        };
        SequentialStrategy.prototype.tryStrategy = function (strategy, minPriority, options, callback) {
            var timer = null;
            var runner = null;
            if (options.timeout > 0) {
                timer = new OneOffTimer(options.timeout, function () {
                    runner.abort();
                    callback(true);
                });
            }
            runner = strategy.connect(minPriority, function (error, handshake) {
                if (error && timer && timer.isRunning() && !options.failFast) {
                    return;
                }
                if (timer) {
                    timer.ensureAborted();
                }
                callback(error, handshake);
            });
            return {
                abort: function () {
                    if (timer) {
                        timer.ensureAborted();
                    }
                    runner.abort();
                },
                forceMinPriority: function (p) {
                    runner.forceMinPriority(p);
                }
            };
        };
        return SequentialStrategy;
    }());
    /* harmony default export */ var sequential_strategy = (sequential_strategy_SequentialStrategy);

    // CONCATENATED MODULE: ./src/core/strategies/best_connected_ever_strategy.ts


    var best_connected_ever_strategy_BestConnectedEverStrategy = (function () {
        function BestConnectedEverStrategy(strategies) {
            this.strategies = strategies;
        }
        BestConnectedEverStrategy.prototype.isSupported = function () {
            return any(this.strategies, util.method('isSupported'));
        };
        BestConnectedEverStrategy.prototype.connect = function (minPriority, callback) {
            return connect(this.strategies, minPriority, function (i, runners) {
                return function (error, handshake) {
                    runners[i].error = error;
                    if (error) {
                        if (allRunnersFailed(runners)) {
                            callback(true);
                        }
                        return;
                    }
                    apply(runners, function (runner) {
                        runner.forceMinPriority(handshake.transport.priority);
                    });
                    callback(null, handshake);
                };
            });
        };
        return BestConnectedEverStrategy;
    }());
    /* harmony default export */ var best_connected_ever_strategy = (best_connected_ever_strategy_BestConnectedEverStrategy);
    function connect(strategies, minPriority, callbackBuilder) {
        var runners = map(strategies, function (strategy, i, _, rs) {
            return strategy.connect(minPriority, callbackBuilder(i, rs));
        });
        return {
            abort: function () {
                apply(runners, abortRunner);
            },
            forceMinPriority: function (p) {
                apply(runners, function (runner) {
                    runner.forceMinPriority(p);
                });
            }
        };
    }
    function allRunnersFailed(runners) {
        return collections_all(runners, function (runner) {
            return Boolean(runner.error);
        });
    }
    function abortRunner(runner) {
        if (!runner.error && !runner.aborted) {
            runner.abort();
            runner.aborted = true;
        }
    }

    // CONCATENATED MODULE: ./src/core/strategies/cached_strategy.ts




    var cached_strategy_CachedStrategy = (function () {
        function CachedStrategy(strategy, transports, options) {
            this.strategy = strategy;
            this.transports = transports;
            this.ttl = options.ttl || 1800 * 1000;
            this.usingTLS = options.useTLS;
            this.timeline = options.timeline;
        }
        CachedStrategy.prototype.isSupported = function () {
            return this.strategy.isSupported();
        };
        CachedStrategy.prototype.connect = function (minPriority, callback) {
            var usingTLS = this.usingTLS;
            var info = fetchTransportCache(usingTLS);
            var strategies = [this.strategy];
            if (info && info.timestamp + this.ttl >= util.now()) {
                var transport = this.transports[info.transport];
                if (transport) {
                    this.timeline.info({
                        cached: true,
                        transport: info.transport,
                        latency: info.latency
                    });
                    strategies.push(new sequential_strategy([transport], {
                        timeout: info.latency * 2 + 1000,
                        failFast: true
                    }));
                }
            }
            var startTimestamp = util.now();
            var runner = strategies
                .pop()
                .connect(minPriority, function cb(error, handshake) {
                if (error) {
                    flushTransportCache(usingTLS);
                    if (strategies.length > 0) {
                        startTimestamp = util.now();
                        runner = strategies.pop().connect(minPriority, cb);
                    }
                    else {
                        callback(error);
                    }
                }
                else {
                    storeTransportCache(usingTLS, handshake.transport.name, util.now() - startTimestamp);
                    callback(null, handshake);
                }
            });
            return {
                abort: function () {
                    runner.abort();
                },
                forceMinPriority: function (p) {
                    minPriority = p;
                    if (runner) {
                        runner.forceMinPriority(p);
                    }
                }
            };
        };
        return CachedStrategy;
    }());
    /* harmony default export */ var cached_strategy = (cached_strategy_CachedStrategy);
    function getTransportCacheKey(usingTLS) {
        return 'pusherTransport' + (usingTLS ? 'TLS' : 'NonTLS');
    }
    function fetchTransportCache(usingTLS) {
        var storage = runtime.getLocalStorage();
        if (storage) {
            try {
                var serializedCache = storage[getTransportCacheKey(usingTLS)];
                if (serializedCache) {
                    return JSON.parse(serializedCache);
                }
            }
            catch (e) {
                flushTransportCache(usingTLS);
            }
        }
        return null;
    }
    function storeTransportCache(usingTLS, transport, latency) {
        var storage = runtime.getLocalStorage();
        if (storage) {
            try {
                storage[getTransportCacheKey(usingTLS)] = safeJSONStringify({
                    timestamp: util.now(),
                    transport: transport,
                    latency: latency
                });
            }
            catch (e) {
            }
        }
    }
    function flushTransportCache(usingTLS) {
        var storage = runtime.getLocalStorage();
        if (storage) {
            try {
                delete storage[getTransportCacheKey(usingTLS)];
            }
            catch (e) {
            }
        }
    }

    // CONCATENATED MODULE: ./src/core/strategies/delayed_strategy.ts

    var delayed_strategy_DelayedStrategy = (function () {
        function DelayedStrategy(strategy, _a) {
            var number = _a.delay;
            this.strategy = strategy;
            this.options = { delay: number };
        }
        DelayedStrategy.prototype.isSupported = function () {
            return this.strategy.isSupported();
        };
        DelayedStrategy.prototype.connect = function (minPriority, callback) {
            var strategy = this.strategy;
            var runner;
            var timer = new OneOffTimer(this.options.delay, function () {
                runner = strategy.connect(minPriority, callback);
            });
            return {
                abort: function () {
                    timer.ensureAborted();
                    if (runner) {
                        runner.abort();
                    }
                },
                forceMinPriority: function (p) {
                    minPriority = p;
                    if (runner) {
                        runner.forceMinPriority(p);
                    }
                }
            };
        };
        return DelayedStrategy;
    }());
    /* harmony default export */ var delayed_strategy = (delayed_strategy_DelayedStrategy);

    // CONCATENATED MODULE: ./src/core/strategies/if_strategy.ts
    var IfStrategy = (function () {
        function IfStrategy(test, trueBranch, falseBranch) {
            this.test = test;
            this.trueBranch = trueBranch;
            this.falseBranch = falseBranch;
        }
        IfStrategy.prototype.isSupported = function () {
            var branch = this.test() ? this.trueBranch : this.falseBranch;
            return branch.isSupported();
        };
        IfStrategy.prototype.connect = function (minPriority, callback) {
            var branch = this.test() ? this.trueBranch : this.falseBranch;
            return branch.connect(minPriority, callback);
        };
        return IfStrategy;
    }());
    /* harmony default export */ var if_strategy = (IfStrategy);

    // CONCATENATED MODULE: ./src/core/strategies/first_connected_strategy.ts
    var FirstConnectedStrategy = (function () {
        function FirstConnectedStrategy(strategy) {
            this.strategy = strategy;
        }
        FirstConnectedStrategy.prototype.isSupported = function () {
            return this.strategy.isSupported();
        };
        FirstConnectedStrategy.prototype.connect = function (minPriority, callback) {
            var runner = this.strategy.connect(minPriority, function (error, handshake) {
                if (handshake) {
                    runner.abort();
                }
                callback(error, handshake);
            });
            return runner;
        };
        return FirstConnectedStrategy;
    }());
    /* harmony default export */ var first_connected_strategy = (FirstConnectedStrategy);

    // CONCATENATED MODULE: ./src/runtimes/web/default_strategy.ts







    function testSupportsStrategy(strategy) {
        return function () {
            return strategy.isSupported();
        };
    }
    var getDefaultStrategy = function (config, baseOptions, defineTransport) {
        var definedTransports = {};
        function defineTransportStrategy(name, type, priority, options, manager) {
            var transport = defineTransport(config, name, type, priority, options, manager);
            definedTransports[name] = transport;
            return transport;
        }
        var ws_options = Object.assign({}, baseOptions, {
            hostNonTLS: config.wsHost + ':' + config.wsPort,
            hostTLS: config.wsHost + ':' + config.wssPort,
            httpPath: config.wsPath
        });
        var wss_options = Object.assign({}, ws_options, {
            useTLS: true
        });
        var sockjs_options = Object.assign({}, baseOptions, {
            hostNonTLS: config.httpHost + ':' + config.httpPort,
            hostTLS: config.httpHost + ':' + config.httpsPort,
            httpPath: config.httpPath
        });
        var timeouts = {
            loop: true,
            timeout: 15000,
            timeoutLimit: 60000
        };
        var ws_manager = new transport_manager({
            lives: 2,
            minPingDelay: 10000,
            maxPingDelay: config.activityTimeout
        });
        var streaming_manager = new transport_manager({
            lives: 2,
            minPingDelay: 10000,
            maxPingDelay: config.activityTimeout
        });
        var ws_transport = defineTransportStrategy('ws', 'ws', 3, ws_options, ws_manager);
        var wss_transport = defineTransportStrategy('wss', 'ws', 3, wss_options, ws_manager);
        var sockjs_transport = defineTransportStrategy('sockjs', 'sockjs', 1, sockjs_options);
        var xhr_streaming_transport = defineTransportStrategy('xhr_streaming', 'xhr_streaming', 1, sockjs_options, streaming_manager);
        var xdr_streaming_transport = defineTransportStrategy('xdr_streaming', 'xdr_streaming', 1, sockjs_options, streaming_manager);
        var xhr_polling_transport = defineTransportStrategy('xhr_polling', 'xhr_polling', 1, sockjs_options);
        var xdr_polling_transport = defineTransportStrategy('xdr_polling', 'xdr_polling', 1, sockjs_options);
        var ws_loop = new sequential_strategy([ws_transport], timeouts);
        var wss_loop = new sequential_strategy([wss_transport], timeouts);
        var sockjs_loop = new sequential_strategy([sockjs_transport], timeouts);
        var streaming_loop = new sequential_strategy([
            new if_strategy(testSupportsStrategy(xhr_streaming_transport), xhr_streaming_transport, xdr_streaming_transport)
        ], timeouts);
        var polling_loop = new sequential_strategy([
            new if_strategy(testSupportsStrategy(xhr_polling_transport), xhr_polling_transport, xdr_polling_transport)
        ], timeouts);
        var http_loop = new sequential_strategy([
            new if_strategy(testSupportsStrategy(streaming_loop), new best_connected_ever_strategy([
                streaming_loop,
                new delayed_strategy(polling_loop, { delay: 4000 })
            ]), polling_loop)
        ], timeouts);
        var http_fallback_loop = new if_strategy(testSupportsStrategy(http_loop), http_loop, sockjs_loop);
        var wsStrategy;
        if (baseOptions.useTLS) {
            wsStrategy = new best_connected_ever_strategy([
                ws_loop,
                new delayed_strategy(http_fallback_loop, { delay: 2000 })
            ]);
        }
        else {
            wsStrategy = new best_connected_ever_strategy([
                ws_loop,
                new delayed_strategy(wss_loop, { delay: 2000 }),
                new delayed_strategy(http_fallback_loop, { delay: 5000 })
            ]);
        }
        return new cached_strategy(new first_connected_strategy(new if_strategy(testSupportsStrategy(ws_transport), wsStrategy, http_fallback_loop)), definedTransports, {
            ttl: 1800000,
            timeline: baseOptions.timeline,
            useTLS: baseOptions.useTLS
        });
    };
    /* harmony default export */ var default_strategy = (getDefaultStrategy);

    // CONCATENATED MODULE: ./src/runtimes/web/transports/transport_connection_initializer.ts

    /* harmony default export */ var transport_connection_initializer = (function () {
        var self = this;
        self.timeline.info(self.buildTimelineMessage({
            transport: self.name + (self.options.useTLS ? 's' : '')
        }));
        if (self.hooks.isInitialized()) {
            self.changeState('initialized');
        }
        else if (self.hooks.file) {
            self.changeState('initializing');
            Dependencies.load(self.hooks.file, { useTLS: self.options.useTLS }, function (error, callback) {
                if (self.hooks.isInitialized()) {
                    self.changeState('initialized');
                    callback(true);
                }
                else {
                    if (error) {
                        self.onError(error);
                    }
                    self.onClose();
                    callback(false);
                }
            });
        }
        else {
            self.onClose();
        }
    });

    // CONCATENATED MODULE: ./src/runtimes/web/http/http_xdomain_request.ts

    var http_xdomain_request_hooks = {
        getRequest: function (socket) {
            var xdr = new window.XDomainRequest();
            xdr.ontimeout = function () {
                socket.emit('error', new RequestTimedOut());
                socket.close();
            };
            xdr.onerror = function (e) {
                socket.emit('error', e);
                socket.close();
            };
            xdr.onprogress = function () {
                if (xdr.responseText && xdr.responseText.length > 0) {
                    socket.onChunk(200, xdr.responseText);
                }
            };
            xdr.onload = function () {
                if (xdr.responseText && xdr.responseText.length > 0) {
                    socket.onChunk(200, xdr.responseText);
                }
                socket.emit('finished', 200);
                socket.close();
            };
            return xdr;
        },
        abortRequest: function (xdr) {
            xdr.ontimeout = xdr.onerror = xdr.onprogress = xdr.onload = null;
            xdr.abort();
        }
    };
    /* harmony default export */ var http_xdomain_request = (http_xdomain_request_hooks);

    // CONCATENATED MODULE: ./src/core/http/http_request.ts
    var http_request_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();


    var MAX_BUFFER_LENGTH = 256 * 1024;
    var http_request_HTTPRequest = (function (_super) {
        http_request_extends(HTTPRequest, _super);
        function HTTPRequest(hooks, method, url) {
            var _this = _super.call(this) || this;
            _this.hooks = hooks;
            _this.method = method;
            _this.url = url;
            return _this;
        }
        HTTPRequest.prototype.start = function (payload) {
            var _this = this;
            this.position = 0;
            this.xhr = this.hooks.getRequest(this);
            this.unloader = function () {
                _this.close();
            };
            runtime.addUnloadListener(this.unloader);
            this.xhr.open(this.method, this.url, true);
            if (this.xhr.setRequestHeader) {
                this.xhr.setRequestHeader('Content-Type', 'application/json');
            }
            this.xhr.send(payload);
        };
        HTTPRequest.prototype.close = function () {
            if (this.unloader) {
                runtime.removeUnloadListener(this.unloader);
                this.unloader = null;
            }
            if (this.xhr) {
                this.hooks.abortRequest(this.xhr);
                this.xhr = null;
            }
        };
        HTTPRequest.prototype.onChunk = function (status, data) {
            while (true) {
                var chunk = this.advanceBuffer(data);
                if (chunk) {
                    this.emit('chunk', { status: status, data: chunk });
                }
                else {
                    break;
                }
            }
            if (this.isBufferTooLong(data)) {
                this.emit('buffer_too_long');
            }
        };
        HTTPRequest.prototype.advanceBuffer = function (buffer) {
            var unreadData = buffer.slice(this.position);
            var endOfLinePosition = unreadData.indexOf('\n');
            if (endOfLinePosition !== -1) {
                this.position += endOfLinePosition + 1;
                return unreadData.slice(0, endOfLinePosition);
            }
            else {
                return null;
            }
        };
        HTTPRequest.prototype.isBufferTooLong = function (buffer) {
            return this.position === buffer.length && buffer.length > MAX_BUFFER_LENGTH;
        };
        return HTTPRequest;
    }(dispatcher));
    /* harmony default export */ var http_request = (http_request_HTTPRequest);

    // CONCATENATED MODULE: ./src/core/http/state.ts
    var State;
    (function (State) {
        State[State["CONNECTING"] = 0] = "CONNECTING";
        State[State["OPEN"] = 1] = "OPEN";
        State[State["CLOSED"] = 3] = "CLOSED";
    })(State || (State = {}));
    /* harmony default export */ var state = (State);

    // CONCATENATED MODULE: ./src/core/http/http_socket.ts



    var autoIncrement = 1;
    var http_socket_HTTPSocket = (function () {
        function HTTPSocket(hooks, url) {
            this.hooks = hooks;
            this.session = randomNumber(1000) + '/' + randomString(8);
            this.location = getLocation(url);
            this.readyState = state.CONNECTING;
            this.openStream();
        }
        HTTPSocket.prototype.send = function (payload) {
            return this.sendRaw(JSON.stringify([payload]));
        };
        HTTPSocket.prototype.ping = function () {
            this.hooks.sendHeartbeat(this);
        };
        HTTPSocket.prototype.close = function (code, reason) {
            this.onClose(code, reason, true);
        };
        HTTPSocket.prototype.sendRaw = function (payload) {
            if (this.readyState === state.OPEN) {
                try {
                    runtime.createSocketRequest('POST', getUniqueURL(getSendURL(this.location, this.session))).start(payload);
                    return true;
                }
                catch (e) {
                    return false;
                }
            }
            else {
                return false;
            }
        };
        HTTPSocket.prototype.reconnect = function () {
            this.closeStream();
            this.openStream();
        };
        HTTPSocket.prototype.onClose = function (code, reason, wasClean) {
            this.closeStream();
            this.readyState = state.CLOSED;
            if (this.onclose) {
                this.onclose({
                    code: code,
                    reason: reason,
                    wasClean: wasClean
                });
            }
        };
        HTTPSocket.prototype.onChunk = function (chunk) {
            if (chunk.status !== 200) {
                return;
            }
            if (this.readyState === state.OPEN) {
                this.onActivity();
            }
            var payload;
            var type = chunk.data.slice(0, 1);
            switch (type) {
                case 'o':
                    payload = JSON.parse(chunk.data.slice(1) || '{}');
                    this.onOpen(payload);
                    break;
                case 'a':
                    payload = JSON.parse(chunk.data.slice(1) || '[]');
                    for (var i = 0; i < payload.length; i++) {
                        this.onEvent(payload[i]);
                    }
                    break;
                case 'm':
                    payload = JSON.parse(chunk.data.slice(1) || 'null');
                    this.onEvent(payload);
                    break;
                case 'h':
                    this.hooks.onHeartbeat(this);
                    break;
                case 'c':
                    payload = JSON.parse(chunk.data.slice(1) || '[]');
                    this.onClose(payload[0], payload[1], true);
                    break;
            }
        };
        HTTPSocket.prototype.onOpen = function (options) {
            if (this.readyState === state.CONNECTING) {
                if (options && options.hostname) {
                    this.location.base = replaceHost(this.location.base, options.hostname);
                }
                this.readyState = state.OPEN;
                if (this.onopen) {
                    this.onopen();
                }
            }
            else {
                this.onClose(1006, 'Server lost session', true);
            }
        };
        HTTPSocket.prototype.onEvent = function (event) {
            if (this.readyState === state.OPEN && this.onmessage) {
                this.onmessage({ data: event });
            }
        };
        HTTPSocket.prototype.onActivity = function () {
            if (this.onactivity) {
                this.onactivity();
            }
        };
        HTTPSocket.prototype.onError = function (error) {
            if (this.onerror) {
                this.onerror(error);
            }
        };
        HTTPSocket.prototype.openStream = function () {
            var _this = this;
            this.stream = runtime.createSocketRequest('POST', getUniqueURL(this.hooks.getReceiveURL(this.location, this.session)));
            this.stream.bind('chunk', function (chunk) {
                _this.onChunk(chunk);
            });
            this.stream.bind('finished', function (status) {
                _this.hooks.onFinished(_this, status);
            });
            this.stream.bind('buffer_too_long', function () {
                _this.reconnect();
            });
            try {
                this.stream.start();
            }
            catch (error) {
                util.defer(function () {
                    _this.onError(error);
                    _this.onClose(1006, 'Could not start streaming', false);
                });
            }
        };
        HTTPSocket.prototype.closeStream = function () {
            if (this.stream) {
                this.stream.unbind_all();
                this.stream.close();
                this.stream = null;
            }
        };
        return HTTPSocket;
    }());
    function getLocation(url) {
        var parts = /([^\?]*)\/*(\??.*)/.exec(url);
        return {
            base: parts[1],
            queryString: parts[2]
        };
    }
    function getSendURL(url, session) {
        return url.base + '/' + session + '/xhr_send';
    }
    function getUniqueURL(url) {
        var separator = url.indexOf('?') === -1 ? '?' : '&';
        return url + separator + 't=' + +new Date() + '&n=' + autoIncrement++;
    }
    function replaceHost(url, hostname) {
        var urlParts = /(https?:\/\/)([^\/:]+)((\/|:)?.*)/.exec(url);
        return urlParts[1] + hostname + urlParts[3];
    }
    function randomNumber(max) {
        return runtime.randomInt(max);
    }
    function randomString(length) {
        var result = [];
        for (var i = 0; i < length; i++) {
            result.push(randomNumber(32).toString(32));
        }
        return result.join('');
    }
    /* harmony default export */ var http_socket = (http_socket_HTTPSocket);

    // CONCATENATED MODULE: ./src/core/http/http_streaming_socket.ts
    var http_streaming_socket_hooks = {
        getReceiveURL: function (url, session) {
            return url.base + '/' + session + '/xhr_streaming' + url.queryString;
        },
        onHeartbeat: function (socket) {
            socket.sendRaw('[]');
        },
        sendHeartbeat: function (socket) {
            socket.sendRaw('[]');
        },
        onFinished: function (socket, status) {
            socket.onClose(1006, 'Connection interrupted (' + status + ')', false);
        }
    };
    /* harmony default export */ var http_streaming_socket = (http_streaming_socket_hooks);

    // CONCATENATED MODULE: ./src/core/http/http_polling_socket.ts
    var http_polling_socket_hooks = {
        getReceiveURL: function (url, session) {
            return url.base + '/' + session + '/xhr' + url.queryString;
        },
        onHeartbeat: function () {
        },
        sendHeartbeat: function (socket) {
            socket.sendRaw('[]');
        },
        onFinished: function (socket, status) {
            if (status === 200) {
                socket.reconnect();
            }
            else {
                socket.onClose(1006, 'Connection interrupted (' + status + ')', false);
            }
        }
    };
    /* harmony default export */ var http_polling_socket = (http_polling_socket_hooks);

    // CONCATENATED MODULE: ./src/runtimes/isomorphic/http/http_xhr_request.ts

    var http_xhr_request_hooks = {
        getRequest: function (socket) {
            var Constructor = runtime.getXHRAPI();
            var xhr = new Constructor();
            xhr.onreadystatechange = xhr.onprogress = function () {
                switch (xhr.readyState) {
                    case 3:
                        if (xhr.responseText && xhr.responseText.length > 0) {
                            socket.onChunk(xhr.status, xhr.responseText);
                        }
                        break;
                    case 4:
                        if (xhr.responseText && xhr.responseText.length > 0) {
                            socket.onChunk(xhr.status, xhr.responseText);
                        }
                        socket.emit('finished', xhr.status);
                        socket.close();
                        break;
                }
            };
            return xhr;
        },
        abortRequest: function (xhr) {
            xhr.onreadystatechange = null;
            xhr.abort();
        }
    };
    /* harmony default export */ var http_xhr_request = (http_xhr_request_hooks);

    // CONCATENATED MODULE: ./src/runtimes/isomorphic/http/http.ts





    var HTTP = {
        createStreamingSocket: function (url) {
            return this.createSocket(http_streaming_socket, url);
        },
        createPollingSocket: function (url) {
            return this.createSocket(http_polling_socket, url);
        },
        createSocket: function (hooks, url) {
            return new http_socket(hooks, url);
        },
        createXHR: function (method, url) {
            return this.createRequest(http_xhr_request, method, url);
        },
        createRequest: function (hooks, method, url) {
            return new http_request(hooks, method, url);
        }
    };
    /* harmony default export */ var http_http = (HTTP);

    // CONCATENATED MODULE: ./src/runtimes/web/http/http.ts


    http_http.createXDR = function (method, url) {
        return this.createRequest(http_xdomain_request, method, url);
    };
    /* harmony default export */ var web_http_http = (http_http);

    // CONCATENATED MODULE: ./src/runtimes/web/runtime.ts












    var Runtime = {
        nextAuthCallbackID: 1,
        auth_callbacks: {},
        ScriptReceivers: ScriptReceivers,
        DependenciesReceivers: DependenciesReceivers,
        getDefaultStrategy: default_strategy,
        Transports: transports_transports,
        transportConnectionInitializer: transport_connection_initializer,
        HTTPFactory: web_http_http,
        TimelineTransport: jsonp_timeline,
        getXHRAPI: function () {
            return window.XMLHttpRequest;
        },
        getWebSocketAPI: function () {
            return window.WebSocket || window.MozWebSocket;
        },
        setup: function (PusherClass) {
            var _this = this;
            window.Pusher = PusherClass;
            var initializeOnDocumentBody = function () {
                _this.onDocumentBody(PusherClass.ready);
            };
            if (!window.JSON) {
                Dependencies.load('json2', {}, initializeOnDocumentBody);
            }
            else {
                initializeOnDocumentBody();
            }
        },
        getDocument: function () {
            return document;
        },
        getProtocol: function () {
            return this.getDocument().location.protocol;
        },
        getAuthorizers: function () {
            return { ajax: xhr_auth, jsonp: jsonp_auth };
        },
        onDocumentBody: function (callback) {
            var _this = this;
            if (document.body) {
                callback();
            }
            else {
                setTimeout(function () {
                    _this.onDocumentBody(callback);
                }, 0);
            }
        },
        createJSONPRequest: function (url, data) {
            return new jsonp_request(url, data);
        },
        createScriptRequest: function (src) {
            return new script_request(src);
        },
        getLocalStorage: function () {
            try {
                return window.localStorage;
            }
            catch (e) {
                return undefined;
            }
        },
        createXHR: function () {
            if (this.getXHRAPI()) {
                return this.createXMLHttpRequest();
            }
            else {
                return this.createMicrosoftXHR();
            }
        },
        createXMLHttpRequest: function () {
            var Constructor = this.getXHRAPI();
            return new Constructor();
        },
        createMicrosoftXHR: function () {
            return new ActiveXObject('Microsoft.XMLHTTP');
        },
        getNetwork: function () {
            return net_info_Network;
        },
        createWebSocket: function (url) {
            var Constructor = this.getWebSocketAPI();
            return new Constructor(url);
        },
        createSocketRequest: function (method, url) {
            if (this.isXHRSupported()) {
                return this.HTTPFactory.createXHR(method, url);
            }
            else if (this.isXDRSupported(url.indexOf('https:') === 0)) {
                return this.HTTPFactory.createXDR(method, url);
            }
            else {
                throw 'Cross-origin HTTP requests are not supported';
            }
        },
        isXHRSupported: function () {
            var Constructor = this.getXHRAPI();
            return (Boolean(Constructor) && new Constructor().withCredentials !== undefined);
        },
        isXDRSupported: function (useTLS) {
            var protocol = useTLS ? 'https:' : 'http:';
            var documentProtocol = this.getProtocol();
            return (Boolean(window['XDomainRequest']) && documentProtocol === protocol);
        },
        addUnloadListener: function (listener) {
            if (window.addEventListener !== undefined) {
                window.addEventListener('unload', listener, false);
            }
            else if (window.attachEvent !== undefined) {
                window.attachEvent('onunload', listener);
            }
        },
        removeUnloadListener: function (listener) {
            if (window.addEventListener !== undefined) {
                window.removeEventListener('unload', listener, false);
            }
            else if (window.detachEvent !== undefined) {
                window.detachEvent('onunload', listener);
            }
        },
        randomInt: function (max) {
            var random = function () {
                var crypto = window.crypto || window['msCrypto'];
                var random = crypto.getRandomValues(new Uint32Array(1))[0];
                return random / Math.pow(2, 32);
            };
            return Math.floor(random() * max);
        }
    };
    /* harmony default export */ var runtime = (Runtime);

    // CONCATENATED MODULE: ./src/core/timeline/level.ts
    var TimelineLevel;
    (function (TimelineLevel) {
        TimelineLevel[TimelineLevel["ERROR"] = 3] = "ERROR";
        TimelineLevel[TimelineLevel["INFO"] = 6] = "INFO";
        TimelineLevel[TimelineLevel["DEBUG"] = 7] = "DEBUG";
    })(TimelineLevel || (TimelineLevel = {}));
    /* harmony default export */ var timeline_level = (TimelineLevel);

    // CONCATENATED MODULE: ./src/core/timeline/timeline.ts



    var timeline_Timeline = (function () {
        function Timeline(key, session, options) {
            this.key = key;
            this.session = session;
            this.events = [];
            this.options = options || {};
            this.sent = 0;
            this.uniqueID = 0;
        }
        Timeline.prototype.log = function (level, event) {
            if (level <= this.options.level) {
                this.events.push(extend({}, event, { timestamp: util.now() }));
                if (this.options.limit && this.events.length > this.options.limit) {
                    this.events.shift();
                }
            }
        };
        Timeline.prototype.error = function (event) {
            this.log(timeline_level.ERROR, event);
        };
        Timeline.prototype.info = function (event) {
            this.log(timeline_level.INFO, event);
        };
        Timeline.prototype.debug = function (event) {
            this.log(timeline_level.DEBUG, event);
        };
        Timeline.prototype.isEmpty = function () {
            return this.events.length === 0;
        };
        Timeline.prototype.send = function (sendfn, callback) {
            var _this = this;
            var data = extend({
                session: this.session,
                bundle: this.sent + 1,
                key: this.key,
                lib: 'js',
                version: this.options.version,
                cluster: this.options.cluster,
                features: this.options.features,
                timeline: this.events
            }, this.options.params);
            this.events = [];
            sendfn(data, function (error, result) {
                if (!error) {
                    _this.sent++;
                }
                if (callback) {
                    callback(error, result);
                }
            });
            return true;
        };
        Timeline.prototype.generateUniqueID = function () {
            this.uniqueID++;
            return this.uniqueID;
        };
        return Timeline;
    }());
    /* harmony default export */ var timeline_timeline = (timeline_Timeline);

    // CONCATENATED MODULE: ./src/core/strategies/transport_strategy.ts




    var transport_strategy_TransportStrategy = (function () {
        function TransportStrategy(name, priority, transport, options) {
            this.name = name;
            this.priority = priority;
            this.transport = transport;
            this.options = options || {};
        }
        TransportStrategy.prototype.isSupported = function () {
            return this.transport.isSupported({
                useTLS: this.options.useTLS
            });
        };
        TransportStrategy.prototype.connect = function (minPriority, callback) {
            var _this = this;
            if (!this.isSupported()) {
                return failAttempt(new UnsupportedStrategy(), callback);
            }
            else if (this.priority < minPriority) {
                return failAttempt(new TransportPriorityTooLow(), callback);
            }
            var connected = false;
            var transport = this.transport.createConnection(this.name, this.priority, this.options.key, this.options);
            var handshake = null;
            var onInitialized = function () {
                transport.unbind('initialized', onInitialized);
                transport.connect();
            };
            var onOpen = function () {
                handshake = factory.createHandshake(transport, function (result) {
                    connected = true;
                    unbindListeners();
                    callback(null, result);
                });
            };
            var onError = function (error) {
                unbindListeners();
                callback(error);
            };
            var onClosed = function () {
                unbindListeners();
                var serializedTransport;
                serializedTransport = safeJSONStringify(transport);
                callback(new TransportClosed(serializedTransport));
            };
            var unbindListeners = function () {
                transport.unbind('initialized', onInitialized);
                transport.unbind('open', onOpen);
                transport.unbind('error', onError);
                transport.unbind('closed', onClosed);
            };
            transport.bind('initialized', onInitialized);
            transport.bind('open', onOpen);
            transport.bind('error', onError);
            transport.bind('closed', onClosed);
            transport.initialize();
            return {
                abort: function () {
                    if (connected) {
                        return;
                    }
                    unbindListeners();
                    if (handshake) {
                        handshake.close();
                    }
                    else {
                        transport.close();
                    }
                },
                forceMinPriority: function (p) {
                    if (connected) {
                        return;
                    }
                    if (_this.priority < p) {
                        if (handshake) {
                            handshake.close();
                        }
                        else {
                            transport.close();
                        }
                    }
                }
            };
        };
        return TransportStrategy;
    }());
    /* harmony default export */ var transport_strategy = (transport_strategy_TransportStrategy);
    function failAttempt(error, callback) {
        util.defer(function () {
            callback(error);
        });
        return {
            abort: function () { },
            forceMinPriority: function () { }
        };
    }

    // CONCATENATED MODULE: ./src/core/strategies/strategy_builder.ts





    var strategy_builder_Transports = runtime.Transports;
    var strategy_builder_defineTransport = function (config, name, type, priority, options, manager) {
        var transportClass = strategy_builder_Transports[type];
        if (!transportClass) {
            throw new UnsupportedTransport(type);
        }
        var enabled = (!config.enabledTransports ||
            arrayIndexOf(config.enabledTransports, name) !== -1) &&
            (!config.disabledTransports ||
                arrayIndexOf(config.disabledTransports, name) === -1);
        var transport;
        if (enabled) {
            options = Object.assign({ ignoreNullOrigin: config.ignoreNullOrigin }, options);
            transport = new transport_strategy(name, priority, manager ? manager.getAssistant(transportClass) : transportClass, options);
        }
        else {
            transport = strategy_builder_UnsupportedStrategy;
        }
        return transport;
    };
    var strategy_builder_UnsupportedStrategy = {
        isSupported: function () {
            return false;
        },
        connect: function (_, callback) {
            var deferred = util.defer(function () {
                callback(new UnsupportedStrategy());
            });
            return {
                abort: function () {
                    deferred.ensureAborted();
                },
                forceMinPriority: function () { }
            };
        }
    };

    // CONCATENATED MODULE: ./src/core/options.ts

    function validateOptions(options) {
        if (options == null) {
            throw 'You must pass an options object';
        }
        if (options.cluster == null) {
            throw 'Options object must provide a cluster';
        }
        if ('disableStats' in options) {
            logger.warn('The disableStats option is deprecated in favor of enableStats');
        }
    }

    // CONCATENATED MODULE: ./src/core/auth/user_authenticator.ts


    var composeChannelQuery = function (params, authOptions) {
        var query = 'socket_id=' + encodeURIComponent(params.socketId);
        for (var key in authOptions.params) {
            query +=
                '&' +
                    encodeURIComponent(key) +
                    '=' +
                    encodeURIComponent(authOptions.params[key]);
        }
        if (authOptions.paramsProvider != null) {
            var dynamicParams = authOptions.paramsProvider();
            for (var key in dynamicParams) {
                query +=
                    '&' +
                        encodeURIComponent(key) +
                        '=' +
                        encodeURIComponent(dynamicParams[key]);
            }
        }
        return query;
    };
    var UserAuthenticator = function (authOptions) {
        if (typeof runtime.getAuthorizers()[authOptions.transport] === 'undefined') {
            throw "'" + authOptions.transport + "' is not a recognized auth transport";
        }
        return function (params, callback) {
            var query = composeChannelQuery(params, authOptions);
            runtime.getAuthorizers()[authOptions.transport](runtime, query, authOptions, AuthRequestType.UserAuthentication, callback);
        };
    };
    /* harmony default export */ var user_authenticator = (UserAuthenticator);

    // CONCATENATED MODULE: ./src/core/auth/channel_authorizer.ts


    var channel_authorizer_composeChannelQuery = function (params, authOptions) {
        var query = 'socket_id=' + encodeURIComponent(params.socketId);
        query += '&channel_name=' + encodeURIComponent(params.channelName);
        for (var key in authOptions.params) {
            query +=
                '&' +
                    encodeURIComponent(key) +
                    '=' +
                    encodeURIComponent(authOptions.params[key]);
        }
        if (authOptions.paramsProvider != null) {
            var dynamicParams = authOptions.paramsProvider();
            for (var key in dynamicParams) {
                query +=
                    '&' +
                        encodeURIComponent(key) +
                        '=' +
                        encodeURIComponent(dynamicParams[key]);
            }
        }
        return query;
    };
    var ChannelAuthorizer = function (authOptions) {
        if (typeof runtime.getAuthorizers()[authOptions.transport] === 'undefined') {
            throw "'" + authOptions.transport + "' is not a recognized auth transport";
        }
        return function (params, callback) {
            var query = channel_authorizer_composeChannelQuery(params, authOptions);
            runtime.getAuthorizers()[authOptions.transport](runtime, query, authOptions, AuthRequestType.ChannelAuthorization, callback);
        };
    };
    /* harmony default export */ var channel_authorizer = (ChannelAuthorizer);

    // CONCATENATED MODULE: ./src/core/auth/deprecated_channel_authorizer.ts
    var ChannelAuthorizerProxy = function (pusher, authOptions, channelAuthorizerGenerator) {
        var deprecatedAuthorizerOptions = {
            authTransport: authOptions.transport,
            authEndpoint: authOptions.endpoint,
            auth: {
                params: authOptions.params,
                headers: authOptions.headers
            }
        };
        return function (params, callback) {
            var channel = pusher.channel(params.channelName);
            var channelAuthorizer = channelAuthorizerGenerator(channel, deprecatedAuthorizerOptions);
            channelAuthorizer.authorize(params.socketId, callback);
        };
    };

    // CONCATENATED MODULE: ./src/core/config.ts
    var __assign = function () {
        __assign = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };





    function getConfig(opts, pusher) {
        var config = {
            activityTimeout: opts.activityTimeout || defaults.activityTimeout,
            cluster: opts.cluster,
            httpPath: opts.httpPath || defaults.httpPath,
            httpPort: opts.httpPort || defaults.httpPort,
            httpsPort: opts.httpsPort || defaults.httpsPort,
            pongTimeout: opts.pongTimeout || defaults.pongTimeout,
            statsHost: opts.statsHost || defaults.stats_host,
            unavailableTimeout: opts.unavailableTimeout || defaults.unavailableTimeout,
            wsPath: opts.wsPath || defaults.wsPath,
            wsPort: opts.wsPort || defaults.wsPort,
            wssPort: opts.wssPort || defaults.wssPort,
            enableStats: getEnableStatsConfig(opts),
            httpHost: getHttpHost(opts),
            useTLS: shouldUseTLS(opts),
            wsHost: getWebsocketHost(opts),
            userAuthenticator: buildUserAuthenticator(opts),
            channelAuthorizer: buildChannelAuthorizer(opts, pusher)
        };
        if ('disabledTransports' in opts)
            config.disabledTransports = opts.disabledTransports;
        if ('enabledTransports' in opts)
            config.enabledTransports = opts.enabledTransports;
        if ('ignoreNullOrigin' in opts)
            config.ignoreNullOrigin = opts.ignoreNullOrigin;
        if ('timelineParams' in opts)
            config.timelineParams = opts.timelineParams;
        if ('nacl' in opts) {
            config.nacl = opts.nacl;
        }
        return config;
    }
    function getHttpHost(opts) {
        if (opts.httpHost) {
            return opts.httpHost;
        }
        if (opts.cluster) {
            return "sockjs-" + opts.cluster + ".pusher.com";
        }
        return defaults.httpHost;
    }
    function getWebsocketHost(opts) {
        if (opts.wsHost) {
            return opts.wsHost;
        }
        return getWebsocketHostFromCluster(opts.cluster);
    }
    function getWebsocketHostFromCluster(cluster) {
        return "ws-" + cluster + ".pusher.com";
    }
    function shouldUseTLS(opts) {
        if (runtime.getProtocol() === 'https:') {
            return true;
        }
        else if (opts.forceTLS === false) {
            return false;
        }
        return true;
    }
    function getEnableStatsConfig(opts) {
        if ('enableStats' in opts) {
            return opts.enableStats;
        }
        if ('disableStats' in opts) {
            return !opts.disableStats;
        }
        return false;
    }
    function buildUserAuthenticator(opts) {
        var userAuthentication = __assign(__assign({}, defaults.userAuthentication), opts.userAuthentication);
        if ('customHandler' in userAuthentication &&
            userAuthentication['customHandler'] != null) {
            return userAuthentication['customHandler'];
        }
        return user_authenticator(userAuthentication);
    }
    function buildChannelAuth(opts, pusher) {
        var channelAuthorization;
        if ('channelAuthorization' in opts) {
            channelAuthorization = __assign(__assign({}, defaults.channelAuthorization), opts.channelAuthorization);
        }
        else {
            channelAuthorization = {
                transport: opts.authTransport || defaults.authTransport,
                endpoint: opts.authEndpoint || defaults.authEndpoint
            };
            if ('auth' in opts) {
                if ('params' in opts.auth)
                    channelAuthorization.params = opts.auth.params;
                if ('headers' in opts.auth)
                    channelAuthorization.headers = opts.auth.headers;
            }
            if ('authorizer' in opts)
                channelAuthorization.customHandler = ChannelAuthorizerProxy(pusher, channelAuthorization, opts.authorizer);
        }
        return channelAuthorization;
    }
    function buildChannelAuthorizer(opts, pusher) {
        var channelAuthorization = buildChannelAuth(opts, pusher);
        if ('customHandler' in channelAuthorization &&
            channelAuthorization['customHandler'] != null) {
            return channelAuthorization['customHandler'];
        }
        return channel_authorizer(channelAuthorization);
    }

    // CONCATENATED MODULE: ./src/core/watchlist.ts
    var watchlist_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();


    var watchlist_WatchlistFacade = (function (_super) {
        watchlist_extends(WatchlistFacade, _super);
        function WatchlistFacade(pusher) {
            var _this = _super.call(this, function (eventName, data) {
                logger.debug("No callbacks on watchlist events for " + eventName);
            }) || this;
            _this.pusher = pusher;
            _this.bindWatchlistInternalEvent();
            return _this;
        }
        WatchlistFacade.prototype.handleEvent = function (pusherEvent) {
            var _this = this;
            pusherEvent.data.events.forEach(function (watchlistEvent) {
                _this.emit(watchlistEvent.name, watchlistEvent);
            });
        };
        WatchlistFacade.prototype.bindWatchlistInternalEvent = function () {
            var _this = this;
            this.pusher.connection.bind('message', function (pusherEvent) {
                var eventName = pusherEvent.event;
                if (eventName === 'pusher_internal:watchlist_events') {
                    _this.handleEvent(pusherEvent);
                }
            });
        };
        return WatchlistFacade;
    }(dispatcher));
    /* harmony default export */ var watchlist = (watchlist_WatchlistFacade);

    // CONCATENATED MODULE: ./src/core/utils/flat_promise.ts
    function flatPromise() {
        var resolve, reject;
        var promise = new Promise(function (res, rej) {
            resolve = res;
            reject = rej;
        });
        return { promise: promise, resolve: resolve, reject: reject };
    }
    /* harmony default export */ var flat_promise = (flatPromise);

    // CONCATENATED MODULE: ./src/core/user.ts
    var user_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var user_UserFacade = (function (_super) {
        user_extends(UserFacade, _super);
        function UserFacade(pusher) {
            var _this = _super.call(this, function (eventName, data) {
                logger.debug('No callbacks on user for ' + eventName);
            }) || this;
            _this.signin_requested = false;
            _this.user_data = null;
            _this.serverToUserChannel = null;
            _this.signinDonePromise = null;
            _this._signinDoneResolve = null;
            _this._onAuthorize = function (err, authData) {
                if (err) {
                    logger.warn("Error during signin: " + err);
                    _this._cleanup();
                    return;
                }
                _this.pusher.send_event('pusher:signin', {
                    auth: authData.auth,
                    user_data: authData.user_data
                });
            };
            _this.pusher = pusher;
            _this.pusher.connection.bind('state_change', function (_a) {
                var previous = _a.previous, current = _a.current;
                if (previous !== 'connected' && current === 'connected') {
                    _this._signin();
                }
                if (previous === 'connected' && current !== 'connected') {
                    _this._cleanup();
                    _this._newSigninPromiseIfNeeded();
                }
            });
            _this.watchlist = new watchlist(pusher);
            _this.pusher.connection.bind('message', function (event) {
                var eventName = event.event;
                if (eventName === 'pusher:signin_success') {
                    _this._onSigninSuccess(event.data);
                }
                if (_this.serverToUserChannel &&
                    _this.serverToUserChannel.name === event.channel) {
                    _this.serverToUserChannel.handleEvent(event);
                }
            });
            return _this;
        }
        UserFacade.prototype.signin = function () {
            if (this.signin_requested) {
                return;
            }
            this.signin_requested = true;
            this._signin();
        };
        UserFacade.prototype._signin = function () {
            if (!this.signin_requested) {
                return;
            }
            this._newSigninPromiseIfNeeded();
            if (this.pusher.connection.state !== 'connected') {
                return;
            }
            this.pusher.config.userAuthenticator({
                socketId: this.pusher.connection.socket_id
            }, this._onAuthorize);
        };
        UserFacade.prototype._onSigninSuccess = function (data) {
            try {
                this.user_data = JSON.parse(data.user_data);
            }
            catch (e) {
                logger.error("Failed parsing user data after signin: " + data.user_data);
                this._cleanup();
                return;
            }
            if (typeof this.user_data.id !== 'string' || this.user_data.id === '') {
                logger.error("user_data doesn't contain an id. user_data: " + this.user_data);
                this._cleanup();
                return;
            }
            this._signinDoneResolve();
            this._subscribeChannels();
        };
        UserFacade.prototype._subscribeChannels = function () {
            var _this = this;
            var ensure_subscribed = function (channel) {
                if (channel.subscriptionPending && channel.subscriptionCancelled) {
                    channel.reinstateSubscription();
                }
                else if (!channel.subscriptionPending &&
                    _this.pusher.connection.state === 'connected') {
                    channel.subscribe();
                }
            };
            this.serverToUserChannel = new channels_channel("#server-to-user-" + this.user_data.id, this.pusher);
            this.serverToUserChannel.bind_global(function (eventName, data) {
                if (eventName.indexOf('pusher_internal:') === 0 ||
                    eventName.indexOf('pusher:') === 0) {
                    return;
                }
                _this.emit(eventName, data);
            });
            ensure_subscribed(this.serverToUserChannel);
        };
        UserFacade.prototype._cleanup = function () {
            this.user_data = null;
            if (this.serverToUserChannel) {
                this.serverToUserChannel.unbind_all();
                this.serverToUserChannel.disconnect();
                this.serverToUserChannel = null;
            }
            if (this.signin_requested) {
                this._signinDoneResolve();
            }
        };
        UserFacade.prototype._newSigninPromiseIfNeeded = function () {
            if (!this.signin_requested) {
                return;
            }
            if (this.signinDonePromise && !this.signinDonePromise.done) {
                return;
            }
            var _a = flat_promise(), promise = _a.promise, resolve = _a.resolve;
            promise.done = false;
            var setDone = function () {
                promise.done = true;
            };
            promise.then(setDone)["catch"](setDone);
            this.signinDonePromise = promise;
            this._signinDoneResolve = resolve;
        };
        return UserFacade;
    }(dispatcher));
    /* harmony default export */ var user = (user_UserFacade);

    // CONCATENATED MODULE: ./src/core/pusher.ts













    var pusher_Pusher = (function () {
        function Pusher(app_key, options) {
            var _this = this;
            checkAppKey(app_key);
            validateOptions(options);
            this.key = app_key;
            this.config = getConfig(options, this);
            this.channels = factory.createChannels();
            this.global_emitter = new dispatcher();
            this.sessionID = runtime.randomInt(1000000000);
            this.timeline = new timeline_timeline(this.key, this.sessionID, {
                cluster: this.config.cluster,
                features: Pusher.getClientFeatures(),
                params: this.config.timelineParams || {},
                limit: 50,
                level: timeline_level.INFO,
                version: defaults.VERSION
            });
            if (this.config.enableStats) {
                this.timelineSender = factory.createTimelineSender(this.timeline, {
                    host: this.config.statsHost,
                    path: '/timeline/v2/' + runtime.TimelineTransport.name
                });
            }
            var getStrategy = function (options) {
                return runtime.getDefaultStrategy(_this.config, options, strategy_builder_defineTransport);
            };
            this.connection = factory.createConnectionManager(this.key, {
                getStrategy: getStrategy,
                timeline: this.timeline,
                activityTimeout: this.config.activityTimeout,
                pongTimeout: this.config.pongTimeout,
                unavailableTimeout: this.config.unavailableTimeout,
                useTLS: Boolean(this.config.useTLS)
            });
            this.connection.bind('connected', function () {
                _this.subscribeAll();
                if (_this.timelineSender) {
                    _this.timelineSender.send(_this.connection.isUsingTLS());
                }
            });
            this.connection.bind('message', function (event) {
                var eventName = event.event;
                var internal = eventName.indexOf('pusher_internal:') === 0;
                if (event.channel) {
                    var channel = _this.channel(event.channel);
                    if (channel) {
                        channel.handleEvent(event);
                    }
                }
                if (!internal) {
                    _this.global_emitter.emit(event.event, event.data);
                }
            });
            this.connection.bind('connecting', function () {
                _this.channels.disconnect();
            });
            this.connection.bind('disconnected', function () {
                _this.channels.disconnect();
            });
            this.connection.bind('error', function (err) {
                logger.warn(err);
            });
            Pusher.instances.push(this);
            this.timeline.info({ instances: Pusher.instances.length });
            this.user = new user(this);
            if (Pusher.isReady) {
                this.connect();
            }
        }
        Pusher.ready = function () {
            Pusher.isReady = true;
            for (var i = 0, l = Pusher.instances.length; i < l; i++) {
                Pusher.instances[i].connect();
            }
        };
        Pusher.getClientFeatures = function () {
            return keys(filterObject({ ws: runtime.Transports.ws }, function (t) {
                return t.isSupported({});
            }));
        };
        Pusher.prototype.channel = function (name) {
            return this.channels.find(name);
        };
        Pusher.prototype.allChannels = function () {
            return this.channels.all();
        };
        Pusher.prototype.connect = function () {
            this.connection.connect();
            if (this.timelineSender) {
                if (!this.timelineSenderTimer) {
                    var usingTLS = this.connection.isUsingTLS();
                    var timelineSender = this.timelineSender;
                    this.timelineSenderTimer = new PeriodicTimer(60000, function () {
                        timelineSender.send(usingTLS);
                    });
                }
            }
        };
        Pusher.prototype.disconnect = function () {
            this.connection.disconnect();
            if (this.timelineSenderTimer) {
                this.timelineSenderTimer.ensureAborted();
                this.timelineSenderTimer = null;
            }
        };
        Pusher.prototype.bind = function (event_name, callback, context) {
            this.global_emitter.bind(event_name, callback, context);
            return this;
        };
        Pusher.prototype.unbind = function (event_name, callback, context) {
            this.global_emitter.unbind(event_name, callback, context);
            return this;
        };
        Pusher.prototype.bind_global = function (callback) {
            this.global_emitter.bind_global(callback);
            return this;
        };
        Pusher.prototype.unbind_global = function (callback) {
            this.global_emitter.unbind_global(callback);
            return this;
        };
        Pusher.prototype.unbind_all = function (callback) {
            this.global_emitter.unbind_all();
            return this;
        };
        Pusher.prototype.subscribeAll = function () {
            var channelName;
            for (channelName in this.channels.channels) {
                if (this.channels.channels.hasOwnProperty(channelName)) {
                    this.subscribe(channelName);
                }
            }
        };
        Pusher.prototype.subscribe = function (channel_name) {
            var channel = this.channels.add(channel_name, this);
            if (channel.subscriptionPending && channel.subscriptionCancelled) {
                channel.reinstateSubscription();
            }
            else if (!channel.subscriptionPending &&
                this.connection.state === 'connected') {
                channel.subscribe();
            }
            return channel;
        };
        Pusher.prototype.unsubscribe = function (channel_name) {
            var channel = this.channels.find(channel_name);
            if (channel && channel.subscriptionPending) {
                channel.cancelSubscription();
            }
            else {
                channel = this.channels.remove(channel_name);
                if (channel && channel.subscribed) {
                    channel.unsubscribe();
                }
            }
        };
        Pusher.prototype.send_event = function (event_name, data, channel) {
            return this.connection.send_event(event_name, data, channel);
        };
        Pusher.prototype.shouldUseTLS = function () {
            return this.config.useTLS;
        };
        Pusher.prototype.signin = function () {
            this.user.signin();
        };
        Pusher.instances = [];
        Pusher.isReady = false;
        Pusher.logToConsole = false;
        Pusher.Runtime = runtime;
        Pusher.ScriptReceivers = runtime.ScriptReceivers;
        Pusher.DependenciesReceivers = runtime.DependenciesReceivers;
        Pusher.auth_callbacks = runtime.auth_callbacks;
        return Pusher;
    }());
    /* harmony default export */ var core_pusher = __webpack_exports__["default"] = (pusher_Pusher);
    function checkAppKey(key) {
        if (key === null || key === undefined) {
            throw 'You must pass your app key when you instantiate Pusher.';
        }
    }
    runtime.setup(pusher_Pusher);


    /***/ })
    /******/ ]);
    });

    });

    var Pusher = /*@__PURE__*/getDefaultExportFromCjs(pusher);

    /* src\Chat.svelte generated by Svelte v3.58.0 */
    const file$2 = "src\\Chat.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (109:2) {:else}
    function create_else_block$1(ctx) {
    	let main;
    	let login;
    	let current;
    	login = new Login({ $$inline: true });

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(login.$$.fragment);
    			add_location(main, file$2, 109, 4, 3037);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(login, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(login.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(login.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(login);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(109:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (82:2) {#if $username}
    function create_if_block$1(ctx) {
    	let main;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t0;
    	let div;
    	let t1;
    	let form;
    	let input;
    	let t2;
    	let button;
    	let t3;
    	let button_disabled_value;
    	let t4;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*messages*/ ctx[1];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*message*/ ctx[14].when;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	let if_block = !/*canAutoScroll*/ ctx[3] && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div = element("div");
    			t1 = space();
    			form = element("form");
    			input = element("input");
    			t2 = space();
    			button = element("button");
    			t3 = text("💥");
    			t4 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div, "class", "dummy");
    			add_location(div, file$2, 87, 6, 2510);
    			add_location(main, file$2, 82, 4, 2347);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Type a message...");
    			attr_dev(input, "maxlength", "100");
    			add_location(input, file$2, 91, 6, 2626);
    			attr_dev(button, "type", "submit");
    			button.disabled = button_disabled_value = !/*newMessage*/ ctx[0];
    			add_location(button, file$2, 93, 6, 2727);
    			add_location(form, file$2, 90, 4, 2574);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(main, null);
    				}
    			}

    			append_dev(main, t0);
    			append_dev(main, div);
    			/*div_binding*/ ctx[9](div);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, form, anchor);
    			append_dev(form, input);
    			set_input_value(input, /*newMessage*/ ctx[0]);
    			append_dev(form, t2);
    			append_dev(form, button);
    			append_dev(button, t3);
    			insert_dev(target, t4, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						main,
    						"scroll",
    						function () {
    							if (is_function(/*debouncedWatchScroll*/ ctx[5])) /*debouncedWatchScroll*/ ctx[5].apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[10]),
    					listen_dev(form, "submit", prevent_default(/*sendMessage*/ ctx[8]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*messages, $username*/ 66) {
    				each_value = /*messages*/ ctx[1];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, main, outro_and_destroy_block, create_each_block, t0, get_each_context);
    				check_outros();
    			}

    			if (dirty & /*newMessage*/ 1 && input.value !== /*newMessage*/ ctx[0]) {
    				set_input_value(input, /*newMessage*/ ctx[0]);
    			}

    			if (!current || dirty & /*newMessage*/ 1 && button_disabled_value !== (button_disabled_value = !/*newMessage*/ ctx[0])) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			if (!/*canAutoScroll*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			/*div_binding*/ ctx[9](null);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(form);
    			if (detaching) detach_dev(t4);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(82:2) {#if $username}",
    		ctx
    	});

    	return block;
    }

    // (84:6) {#each messages as message (message.when)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let chatmessage;
    	let current;

    	chatmessage = new ChatMessage({
    			props: {
    				message: /*message*/ ctx[14],
    				sender: /*$username*/ ctx[6]
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(chatmessage.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(chatmessage, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const chatmessage_changes = {};
    			if (dirty & /*messages*/ 2) chatmessage_changes.message = /*message*/ ctx[14];
    			if (dirty & /*$username*/ 64) chatmessage_changes.sender = /*$username*/ ctx[6];
    			chatmessage.$set(chatmessage_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(chatmessage.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(chatmessage.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(chatmessage, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(84:6) {#each messages as message (message.when)}",
    		ctx
    	});

    	return block;
    }

    // (98:4) {#if !canAutoScroll}
    function create_if_block_1(ctx) {
    	let div;
    	let button;
    	let t;
    	let mounted;
    	let dispose;
    	let if_block = /*unreadMessages*/ ctx[4] && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			if (if_block) if_block.c();
    			t = text("\n\n        👇");
    			toggle_class(button, "red", /*unreadMessages*/ ctx[4]);
    			add_location(button, file$2, 99, 6, 2861);
    			attr_dev(div, "class", "scroll-button");
    			add_location(div, file$2, 98, 4, 2827);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    			if (if_block) if_block.m(button, null);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*autoScroll*/ ctx[7], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*unreadMessages*/ ctx[4]) {
    				if (if_block) ; else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(button, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*unreadMessages*/ 16) {
    				toggle_class(button, "red", /*unreadMessages*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(98:4) {#if !canAutoScroll}",
    		ctx
    	});

    	return block;
    }

    // (101:8) {#if unreadMessages}
    function create_if_block_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("💬");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(101:8) {#if unreadMessages}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$username*/ ctx[6]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "container");
    			add_location(div, file$2, 80, 0, 2301);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let debouncedWatchScroll;
    	let $username;
    	validate_store(username, 'username');
    	component_subscribe($$self, username, $$value => $$invalidate(6, $username = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Chat', slots, []);
    	const db = browser();
    	let newMessage;
    	let messages = [];
    	let scrollBottom;
    	let lastScrollTop;
    	let canAutoScroll = true;
    	let unreadMessages = false;

    	function autoScroll() {
    		setTimeout(() => scrollBottom?.scrollIntoView({ behavior: 'auto' }), 50);
    		$$invalidate(4, unreadMessages = false);
    	}

    	function watchScroll(e) {
    		$$invalidate(3, canAutoScroll = (e.target.scrollTop || Infinity) > lastScrollTop);
    		lastScrollTop = e.target.scrollTop;
    	}

    	onMount(() => {
    		var match = {
    			// lexical queries are kind of like a limited RegEx or Glob.
    			'.': {
    				// property selector
    				'>': new Date(+new Date() - 1 * 1000 * 60 * 60 * 3).toISOString(), // find any indexed property larger ~3 hours ago
    				
    			},
    			'-': 1, // filter in reverse
    			
    		};

    		// Get Messages
    		db.get('chat').map(match).once(async (data, id) => {
    			if (data) {
    				// Key for end-to-end encryption
    				const key = '#encryption';

    				var message = {
    					// transform the data
    					who: await db.user(data).get('alias'), // a user might lie who they are! So let the user system detect whose data it is.
    					what: await SEA.decrypt(data.what, key) + '', // force decrypt as text.
    					when: browser.state.is(data, 'what'), // get the internal timestamp for the what property.
    					
    				};

    				if (message.what) {
    					$$invalidate(1, messages = [...messages.slice(-100), message].sort((a, b) => a.when - b.when));

    					if (canAutoScroll) {
    						autoScroll();
    					} else {
    						$$invalidate(4, unreadMessages = true);
    					}
    				}
    			}
    		});
    	});

    	async function sendMessage() {
    		const secret = await SEA.encrypt(newMessage, '#encryption');
    		const message = user.get('all').set({ what: secret });
    		const index = new Date().toISOString();
    		db.get('chat').get(index).put(message);
    		$$invalidate(0, newMessage = '');
    		$$invalidate(3, canAutoScroll = true);
    		autoScroll();
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Chat> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			scrollBottom = $$value;
    			$$invalidate(2, scrollBottom);
    		});
    	}

    	function input_input_handler() {
    		newMessage = this.value;
    		$$invalidate(0, newMessage);
    	}

    	$$self.$capture_state = () => ({
    		Login,
    		ChatMessage,
    		onMount,
    		username,
    		user,
    		debounce: lodash_debounce,
    		Pusher,
    		GUN: browser,
    		db,
    		newMessage,
    		messages,
    		scrollBottom,
    		lastScrollTop,
    		canAutoScroll,
    		unreadMessages,
    		autoScroll,
    		watchScroll,
    		sendMessage,
    		debouncedWatchScroll,
    		$username
    	});

    	$$self.$inject_state = $$props => {
    		if ('newMessage' in $$props) $$invalidate(0, newMessage = $$props.newMessage);
    		if ('messages' in $$props) $$invalidate(1, messages = $$props.messages);
    		if ('scrollBottom' in $$props) $$invalidate(2, scrollBottom = $$props.scrollBottom);
    		if ('lastScrollTop' in $$props) lastScrollTop = $$props.lastScrollTop;
    		if ('canAutoScroll' in $$props) $$invalidate(3, canAutoScroll = $$props.canAutoScroll);
    		if ('unreadMessages' in $$props) $$invalidate(4, unreadMessages = $$props.unreadMessages);
    		if ('debouncedWatchScroll' in $$props) $$invalidate(5, debouncedWatchScroll = $$props.debouncedWatchScroll);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$invalidate(5, debouncedWatchScroll = lodash_debounce(watchScroll, 1000));

    	return [
    		newMessage,
    		messages,
    		scrollBottom,
    		canAutoScroll,
    		unreadMessages,
    		debouncedWatchScroll,
    		$username,
    		autoScroll,
    		sendMessage,
    		div_binding,
    		input_input_handler
    	];
    }

    class Chat extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Chat",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\Header.svelte generated by Svelte v3.58.0 */
    const file$1 = "src\\Header.svelte";

    // (21:4) {:else}
    function create_else_block(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Gun.js Chat";
    			add_location(h3, file$1, 22, 6, 459);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(21:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (12:2) {#if $username}
    function create_if_block(ctx) {
    	let div;
    	let span;
    	let t0;
    	let strong;
    	let t1;
    	let t2;
    	let img;
    	let img_src_value;
    	let t3;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = text("Hello ");
    			strong = element("strong");
    			t1 = text(/*$username*/ ctx[0]);
    			t2 = space();
    			img = element("img");
    			t3 = space();
    			button = element("button");
    			button.textContent = "Sign Out";
    			add_location(strong, file$1, 14, 18, 224);
    			add_location(span, file$1, 14, 6, 212);
    			if (!src_url_equal(img.src, img_src_value = `https://avatars.dicebear.com/api/initials/${/*$username*/ ctx[0]}.svg`)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "avatar");
    			add_location(img, file$1, 15, 6, 266);
    			attr_dev(div, "class", "user-bio");
    			add_location(div, file$1, 12, 4, 176);
    			attr_dev(button, "class", "signout-button");
    			add_location(button, file$1, 18, 4, 371);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(span, t0);
    			append_dev(span, strong);
    			append_dev(strong, t1);
    			append_dev(div, t2);
    			append_dev(div, img);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*signout*/ ctx[1], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$username*/ 1) set_data_dev(t1, /*$username*/ ctx[0]);

    			if (dirty & /*$username*/ 1 && !src_url_equal(img.src, img_src_value = `https://avatars.dicebear.com/api/initials/${/*$username*/ ctx[0]}.svg`)) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(12:2) {#if $username}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let header;
    	let h1;
    	let t1;

    	function select_block_type(ctx, dirty) {
    		if (/*$username*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "🔫💬";
    			t1 = space();
    			if_block.c();
    			add_location(h1, file$1, 10, 0, 140);
    			add_location(header, file$1, 9, 0, 131);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			append_dev(header, t1);
    			if_block.m(header, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(header, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $username;
    	validate_store(username, 'username');
    	component_subscribe($$self, username, $$value => $$invalidate(0, $username = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);

    	function signout() {
    		user.leave();
    		username.set('');
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ username, user, signout, $username });
    	return [$username, signout];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.58.0 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let div;
    	let header;
    	let t;
    	let chat;
    	let current;
    	header = new Header({ $$inline: true });
    	chat = new Chat({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(header.$$.fragment);
    			t = space();
    			create_component(chat.$$.fragment);
    			attr_dev(div, "class", "app");
    			add_location(div, file, 5, 0, 96);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(header, div, null);
    			append_dev(div, t);
    			mount_component(chat, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(chat.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(chat.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(header);
    			destroy_component(chat);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Chat, Header });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
