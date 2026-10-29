/* Flare – Dynamic Search Dropdown (EN, body-mounted, CSS-driven look + query guards) */
(function () {
		var MIN_CHARS = 2;
		var MAX_ITEMS = 5;
		var DEBUG = false;

		function log(){ if (DEBUG && window.console) console.log.apply(console, ['[dropdown]'].concat([].slice.call(arguments))); }
		function debounce(fn, delay){ if (delay == null) delay = 300; var t; return function(){ var a = arguments; clearTimeout(t); t = setTimeout(function(){ fn.apply(null, a); }, delay); }; }
		function onReady(cb){
			if (window.MadCap && MadCap.Utilities && MadCap.Utilities.OnLoad) MadCap.Utilities.OnLoad(cb);
			else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb); else cb();
		}

		function findInput() {
			var selectors = [
				'.main-section .search-bar > input',
				'.search-bar input[type="search"]',
				'.search-field input[type="search"]',
				'header .search input[type="search"]',
				'input#search-field','input#searchField','input#searchBox','input#searchText',
				'input#search','input#search-input','input#searchInput',
				'input[type="search"]','input[id*="search" i]','[role="search"] input',
				'[class*="search" i] input','input[role="searchbox"]','input[aria-label*="search" i]','input[placeholder*="search" i]'
				];
			for (var i = 0;i < selectors.length;i++){ var el = document.querySelector(selectors[i]); if (el) return el; }
			var inputs = document.getElementsByTagName('input');
			for (var j = 0;j < inputs.length;j++){
				var it = inputs[j], t = (it.type || '').toLowerCase(), id = (it.id || '').toLowerCase(), ph = (it.placeholder || '').toLowerCase();
				var aria = (it.getAttribute('aria-label') || '').toLowerCase(), r = (it.getAttribute('role') || '').toLowerCase();
				if (t === 'search' || r === 'searchbox' || id.indexOf('search') >= 0 || ph.indexOf('search') >= 0 || aria.indexOf('search') >= 0) return it;
			}
			return null;
		}

		/* ---- Query validator (prevents Flare alert) ----
		- blocks: only quotes, trailing operator, unbalanced () or ""
		- includes FR operators too to avoid flicker while typing
		*/
		function isQueryValid(q){
			if (!q) return false;
			if (q.replace(/"/g,'').trim().length < 1) return false; // handles "" "" etc.
				var endsWithOp = /\b(AND|OR|NOT|NEAR|ET|OU|SAUF)\s*$/i.test(q);
			if (endsWithOp) return false;
			var openP = (q.match(/\(/g) || []).length, closeP = (q.match(/\)/g) || []).length;
			if (openP !== closeP) return false;
			var quoteCount = (q.match(/"/g) || []).length;
				if (quoteCount % 2 === 1) return false;
			return true;
		}

		// Body-mounted dropdown to avoid clipping/overflow
		function ensureBodyDropdown() {
			var dd = document.getElementById('searchResultsDropdown');
			if (!dd) {
				dd = document.createElement('ul');
				dd.id = 'searchResultsDropdown';
				dd.setAttribute('role', 'listbox');
				dd.setAttribute('aria-label', 'Search suggestions');
				// minimal layout inline; visuals via CSS
				dd.style.position = 'fixed';
				dd.style.display = 'none';
				dd.style.visibility = 'hidden';
				dd.style.zIndex = '2147483647';
				document.body.appendChild(dd);
				log('dropdown created (body-mounted)');
			}
			return dd;
		}

		function positionDropdown(dd, input){
			var r = input.getBoundingClientRect();
			var gap = 10;
			var width = Math.max(input.offsetWidth || (r.right - r.left), 360);
			dd.style.top = (r.bottom + gap) + 'px';
			dd.style.left = (r.left) + 'px';
			dd.style.width = width + 'px';
		}

		function hide(dd){ dd.style.display = 'none'; dd.style.visibility = 'hidden'; dd.innerHTML = ''; }
		function show(dd){ dd.style.display = 'block'; dd.style.visibility = 'visible'; }

		// Always send to /<lang>/Search_results.htm?q=...
		function goToFullResults(q){
			var href = window.location.href;
			var m = href.match(/\/(fr|en)\//i);
			if (m) {
				var idx = href.indexOf(m[0]);
				var prefix = href.slice(0, idx + m[0].length);
				window.location.href = prefix + 'Search_results.htm?q=' + encodeURIComponent(q);
				return;
			}
			if (typeof window.gRootRelPath === 'string' && window.gRootRelPath) {
				var url = new URL(window.gRootRelPath + 'Search_results.htm?q=' + encodeURIComponent(q), href);
				window.location.href = url.href;
				return;
			}
			var base = href.slice(0, href.lastIndexOf('/') + 1);
			window.location.href = base + '../Search_results.htm?q=' + encodeURIComponent(q);
		}

		function displayItems(dd, items, q) {
			dd.innerHTML = '';
			var max = Math.min(items.length, MAX_ITEMS);
			if (max === 0) { hide(dd); return; }

			if (items.length > max) {
				var more = document.createElement('li');
				more.className = 'show-all';
				more.textContent = 'Showing ' + max + ' ' + (max === 1 ? 'result' : 'results') + '. Press Enter to see all results';
				dd.appendChild(more); // informational only
			}

			for (var i = 0; i < max; i++) {
				var it = items[i];
				var li = document.createElement('li');
				li.className = 'result';
				li.innerHTML =
					'<div class="title">' + (it.Title || 'Untitled') + '</div>' +
					'<div class="preview">' + (it.AbstractText || '') + '</div>';
				(function (link) {
						li.addEventListener('click', function () {
								window.location.href = link + '?Highlight=' + encodeURIComponent(q);
							});
					})(it.Link);
				dd.appendChild(li);
			}

			show(dd);
		}

		function execSearch(q) {
			try {
				var out = MadCap.SearchHelper.SearchPane.Search(q, { searchContent: true });
				if (out && typeof out.then === 'function') return out;
				if (out && out.content) return Promise.resolve(out);
				return Promise.resolve({ content: [] });
			} catch (e) {
				return Promise.resolve({ content: [] });
			}
		}

		function init() {
			var attempts = 0, maxAttempts = 20;
			(function retry(){
					attempts++;
					var input = findInput();
					if (!input) { if (attempts < maxAttempts) return setTimeout(retry, 250); return; }
					var dd = ensureBodyDropdown();
					positionDropdown(dd, input);

					var doSearch = debounce(function () {
							positionDropdown(dd, input);
							var q = (input.value || '').trim();

							// new guards (same logic as FR)
							if (q.length < MIN_CHARS) { hide(dd); return; }
							if (!isQueryValid(q)) { hide(dd); return; }

							if (!window.MadCap || !MadCap.SearchHelper || !MadCap.SearchHelper.SearchPane) { hide(dd); return; }

							execSearch(q).then(function (res) {
									var items = (res && res.content) ? res.content : [];
									displayItems(dd, items, q);
									}).catch(function(){ hide(dd); });
						}, 300);

					input.addEventListener('input', doSearch);

					// Enter: only proceed if query is valid; otherwise suppress alert
					input.addEventListener('keydown', function (e) {
							if (e.key === 'Enter') {
								var q = (input.value || '').trim();
								if (q.length < MIN_CHARS || !isQueryValid(q)) {
									e.preventDefault(); hide(dd); return;
								}
								e.preventDefault(); hide(dd); goToFullResults(q);
							} else if (e.key === 'Escape') {
								hide(dd);
							}
						});

					document.addEventListener('click', function (e) { if (!dd.contains(e.target) && e.target !== input) hide(dd); });
					window.addEventListener('resize', function(){ positionDropdown(dd, input); });
					window.addEventListener('scroll', function(){ positionDropdown(dd, input); }, true);
				})();
		}

		onReady(init);
	})();
