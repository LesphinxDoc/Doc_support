/* Flare – Dynamic Search Dropdown (FR, container-mounted, sans redirection custom)
   - Affiche le dropdown après saisie (>= 2 caractères) et requête valide
   - Bandeau informatif en haut (non cliquable)
   - Laisse Flare gérer la recherche complète sur Entrée
   - Empêche l’alerte Flare si la requête est invalide
   - Clic résultat -> ajoute ?Highlight=...
*/
(function () {
		var MIN_CHARS = 2;
		var MAX_ITEMS = 5;

		function debounce(fn, delay) {
			if (delay == null) delay = 300;
			var t;
			return function () {
					var args = arguments;
					clearTimeout(t);
					t = setTimeout(function () { fn.apply(null, args); }, delay);
				};
		}

		function findSearchElements() {
			var input =
				document.querySelector('.main-section .search-bar > input') ||
				document.querySelector('.search-bar input[type="search"]') ||
				document.querySelector('.search-field input[type="search"]') ||
				document.querySelector('input#search-field') ||
				document.querySelector('input[role="searchbox"]') ||
				document.querySelector('input[aria-label="Search"]');
			if (!input) return null;
			var container = (input.closest && (input.closest('.search-bar') || input.closest('.search-field'))) || input.parentElement;
			if (container && getComputedStyle(container).position === 'static') container.style.position = 'relative';
			return { input: input, container: container };
		}

		function ensureDropDown(container) {
			var dd = container.querySelector('#searchResultsDropdown');
			if (!dd) {
				dd = document.createElement('ul');
				dd.id = 'searchResultsDropdown';
				dd.setAttribute('role', 'listbox');
				dd.setAttribute('aria-label', 'Search suggestions');
				dd.style.visibility = 'hidden'; // caché par défaut
				container.appendChild(dd);
			}
			return dd;
		}

		function hide(dropdown){
			dropdown.style.visibility = 'hidden';
			dropdown.innerHTML = '';
		}

		// --- Validation pour éviter l’alerte Flare ---
		function isQueryValid(q){
			if (!q) return false;
			// si ce n'est que des guillemets/espaces -> invalide
			if (q.replace(/"/g,'').trim().length < 1) return false;
				// éviter l'état "en cours de saisie" d’un opérateur (FR inclus pour limiter le flicker)
				if (/\b(AND|OR|NOT|NEAR|ET|OU|SAUF)\s*$/i.test(q)) return false;
			// parenthèses appariées
			var openP = (q.match(/\(/g) || []).length;
			var closeP = (q.match(/\)/g) || []).length;
			if (openP !== closeP) return false;
			// guillemets appariés
			var quoteCount = (q.match(/"/g) || []).length;
				if (quoteCount % 2 === 1) return false;
			return true;
		}

		function displayItems(dropdown, items, q) {
			dropdown.innerHTML = '';
			var max = Math.min(items.length, MAX_ITEMS);
			if (max === 0) { hide(dropdown); return; }

			// Bandeau informatif (non cliquable)
			if (items.length > max) {
				var more = document.createElement('li');
				more.className = 'show-all';
				var mot = (max === 1) ? 'résultat' : 'résultats';
				more.textContent = 'Affichage de ' + max + ' ' + mot + '. Appuyez sur Entrée pour afficher tous les résultats';
				dropdown.appendChild(more);
			}

			// Résultats
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
				dropdown.appendChild(li);
			}

			dropdown.style.visibility = 'visible';
		}

		// Enveloppe de l’API Flare (promise ou non)
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
			var found = findSearchElements();
			if (!found) return;
			var input = found.input, container = found.container;
			var dropdown = ensureDropDown(container);

			var doSearch = debounce(function () {
					var q = (input.value || '').trim();

					// n’afficher que si longueur suffisante ET requête valide
					if (q.length < MIN_CHARS) { hide(dropdown); return; }
					if (!isQueryValid(q)) { hide(dropdown); return; }

					if (!window.MadCap || !MadCap.SearchHelper || !MadCap.SearchHelper.SearchPane) { hide(dropdown); return; }

					execSearch(q).then(function (res) {
							var items = (res && res.content) ? res.content : [];
							displayItems(dropdown, items, q);
							}).catch(function(){ hide(dropdown); });
				}, 300);

			input.addEventListener('input', doSearch);

			// Entrée : si invalide -> on bloque (évite popup) ; si valide -> on laisse Flare faire (pas de preventDefault)
			input.addEventListener('keydown', function (e) {
					if (e.key === 'Enter') {
						var q = (input.value || '').trim();
						if (q.length < MIN_CHARS || !isQueryValid(q)) {
							e.preventDefault();
							hide(dropdown);
							return;
						}
						hide(dropdown); // propre visuel; pas de preventDefault pour laisser Flare naviguer
					} else if (e.key === 'Escape') {
						hide(dropdown);
					}
				});

			// clic à l’extérieur => fermer
			document.addEventListener('click', function (e) {
					if (!container.contains(e.target)) hide(dropdown);
				});
		}

		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
		else init();
	})();
