let currentFilter = "Alla";
      let currentSort = "newest";
      let recipes = [];

      function init() {
        try {
          const data = window.RECIPES_DATA;
          if (!data || !Array.isArray(data.recipes)) {
            throw new Error("Ogiltig eller saknad receptdata");
          }
          recipes = data.recipes;

          if (recipes.length > 0) {
            const topRecipeId = window.APP_OPTIONS?.["Top recipe"];
            const selectedTopRecipe = recipes.find(
              (r) => Number(r.id) === Number(topRecipeId),
            );
            const heroBadge = window.APP_OPTIONS?.["Hero badge"] || "";
            document.getElementById("heroBadge").textContent = heroBadge;
            const heroRecipe = selectedTopRecipe || recipes[0];
            displayHero(heroRecipe);
            updateSeo(heroRecipe);
          }

          createFilterButtons();
          initNavbarSearch();
          filterAndDisplay(
            document.getElementById("searchInput").value.toLowerCase(),
          );
        } catch (error) {
          console.error("Error loading recipes:", error);
          document.getElementById("recipesGrid").innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                        <h3 style="color: #e53e3e; margin-bottom: 1rem;">Kunde inte ladda recept</h3>
                        <p style="color: #718096;">Kontrollera att recipes-data.js finns och definierar window.RECIPES_DATA.</p>
                    </div>
                `;
        }
      }

      function isPortionBased(recipe) {
        const amountText = (recipe.amount || "").toLowerCase();
        return /portion|serving|st\b/.test(amountText);
      }

      function getPortionLabel(recipe, scale = 1) {
        const amountText = (recipe.amount || "").trim();
        if (scale === 1 && amountText) {
          return amountText;
        }
        const baseServings = Number(recipe.servings);
        if (Number.isFinite(baseServings) && baseServings > 0) {
          const scaled = baseServings * scale;
          const rounded =
            Math.abs(scaled - Math.round(scaled)) < 1e-6
              ? String(Math.round(scaled))
              : scaled
                  .toFixed(2)
                  .replace(/\.00$/, "")
                  .replace(/(\.[0-9]*?)0+$/, "$1");
          return `${rounded} portioner`;
        }
        return amountText || "Saknas";
      }

      function formatAddedDate(dateValue) {
        if (!dateValue) return "Tillagd: OkÃ¤nt datum";
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) return "Tillagd: OkÃ¤nt datum";
        const formatted = new Intl.DateTimeFormat("sv-SE", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(parsed);
        return `Tillagd: ${formatted}`;
      }

      function updateSeo(topRecipe) {
        const fallbackDescription =
          "Angelikas Kitchen med recept på mat, bakning, dryck och tillbehör.";
        const title = "Angelikas Kitchen";
        const description = topRecipe?.description
          ? `${topRecipe.title}: ${topRecipe.description}`.slice(0, 155)
          : fallbackDescription;
        const defaultUrl = "https://angelikaskitchen.se/";
        const pageUrl =
          location.origin && location.origin !== "null"
            ? location.href
            : defaultUrl;

        let imageUrl = topRecipe?.image || "images/ak.png";
        try {
          imageUrl = new URL(imageUrl, pageUrl).toString();
        } catch (error) {
          imageUrl = `${defaultUrl}images/ak.png`;
        }

        document.title = title;
        document.getElementById("metaDescription").setAttribute("content", description);
        document.getElementById("ogTitle").setAttribute("content", title);
        document.getElementById("ogDescription").setAttribute("content", description);
        document.getElementById("ogImage").setAttribute("content", imageUrl);
        document.getElementById("twitterTitle").setAttribute("content", title);
        document
          .getElementById("twitterDescription")
          .setAttribute("content", description);
        document.getElementById("twitterImage").setAttribute("content", imageUrl);

        const schema = {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "Angelikas Kitchen",
              url: defaultUrl,
              inLanguage: "sv-SE",
            },
            {
              "@type": "Organization",
              name: "Angelikas Kitchen",
              url: defaultUrl,
              sameAs: [
                "https://www.instagram.com/angelikaskitchen",
                "https://www.tiktok.com/@angelikaskitchen",
              ],
            },
          ],
        };

        if (topRecipe) {
          schema["@graph"].push({
            "@type": "Recipe",
            name: topRecipe.title,
            description: topRecipe.description,
            image: imageUrl,
            datePublished: topRecipe.dateAdded || undefined,
            recipeCategory: getRecipeCategoryLabels(topRecipe),
            totalTime: topRecipe.time || undefined,
          });
        }

        document.getElementById("structuredData").textContent = JSON.stringify(schema);
      }

      function translateCategory(category) {
        return category;
      }

      function getRecipeCategories(recipe) {
        return recipe.categories || [recipe.category];
      }

      function getRecipeCategoryLabels(recipe) {
        return getRecipeCategories(recipe).map(translateCategory);
      }

      function getSortedRecipes(list) {
        const sorted = [...list];
        if (currentSort === "az") {
          sorted.sort((a, b) => a.title.localeCompare(b.title));
          return sorted;
        }
        if (currentSort === "za") {
          sorted.sort((a, b) => b.title.localeCompare(a.title));
          return sorted;
        }
        if (currentSort === "oldest") {
          sorted.sort(
            (a, b) =>
              new Date(a.dateAdded || 0).getTime() -
              new Date(b.dateAdded || 0).getTime(),
          );
          return sorted;
        }
        sorted.sort(
          (a, b) =>
            new Date(b.dateAdded || 0).getTime() -
            new Date(a.dateAdded || 0).getTime(),
        );
        return sorted;
      }

      function displayHero(recipe) {
        document.getElementById("heroImage").src = recipe.image;
        document.getElementById("heroCategory").innerHTML =
          getRecipeCategoryLabels(recipe)
            .map((cat) => `<span class="recipe-category">${cat}</span>`)
            .join("");
        document.getElementById("heroTitle").textContent = recipe.title;
        document.getElementById("heroDescription").textContent =
          recipe.description;
        document.getElementById("heroTime").textContent = recipe.time;
        document.getElementById("heroServings").textContent =
          getPortionLabel(recipe);
        document.getElementById("heroBtn").onclick = () => openModal(recipe);
      }

      function createFilterButtons() {
        const uniqueCategories = [
          ...new Set(recipes.flatMap((r) => getRecipeCategories(r))),
        ].sort((a, b) => a.localeCompare(b, "sv-SE"));
        const categories = ["Alla", ...uniqueCategories];
        const filterContainer = document.getElementById("filterButtons");
        filterContainer.innerHTML = "";

        categories.forEach((cat) => {
          const btn = document.createElement("button");
          btn.className = "filter-btn" + (cat === "Alla" ? " active" : "");
          btn.textContent = cat === "Alla" ? "Alla" : translateCategory(cat);
          btn.dataset.category = cat;
          btn.onclick = () => filterRecipes(cat);
          filterContainer.appendChild(btn);
        });
      }

      function initNavbarSearch() {
        const wrapper = document.getElementById("navSearch");
        const toggle = document.getElementById("navSearchToggle");
        const dropdown = document.getElementById("navSearchDropdown");
        const input = document.getElementById("navSearchInput");
        const results = document.getElementById("navSearchResults");
        if (!wrapper || !toggle || !dropdown || !input || !results) return;
        if (toggle.dataset.bound === "1") return;
        toggle.dataset.bound = "1";

        const closeDropdown = () => {
          dropdown.hidden = true;
          toggle.setAttribute("aria-expanded", "false");
        };
        const openDropdown = () => {
          dropdown.hidden = false;
          toggle.setAttribute("aria-expanded", "true");
          renderResults(input.value.trim().toLowerCase());
          setTimeout(() => input.focus(), 0);
        };
        const getResultLabel = (recipe) =>
          `${recipe.time} • ${getRecipeCategoryLabels(recipe).slice(0, 2).join(", ")}`;

        const renderResults = (query) => {
          if (!query) {
            results.innerHTML = "";
            return;
          }
          let matches = recipes;
          matches = recipes.filter((r) => {
            const haystack = [
              r.title,
              r.description,
              getRecipeCategories(r).join(" "),
              getRecipeCategoryLabels(r).join(" "),
            ]
              .join(" ")
              .toLowerCase();
            return haystack.includes(query);
          });
          matches = getSortedRecipes(matches).slice(0, 8);

          if (matches.length === 0) {
            results.innerHTML = `<div class="nav-search-empty">Inga resultat</div>`;
            return;
          }

          results.innerHTML = "";
          matches.forEach((recipe) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "nav-search-item";
            btn.innerHTML = `
              <img class="nav-search-thumb" src="${recipe.image}" alt="${recipe.title}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/120x120?text=Bild'">
              <div>
                <div class="nav-search-title">${recipe.title}</div>
                <div class="nav-search-meta">${getResultLabel(recipe)}</div>
              </div>
            `;
            btn.onclick = () => {
              closeDropdown();
              openModal(recipe);
            };
            results.appendChild(btn);
          });
        };

        toggle.addEventListener("click", () => {
          if (dropdown.hidden) {
            openDropdown();
          } else {
            closeDropdown();
          }
        });
        input.addEventListener("input", (e) => {
          renderResults(e.target.value.trim().toLowerCase());
        });
        document.addEventListener("click", (e) => {
          if (!wrapper.contains(e.target)) {
            closeDropdown();
          }
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            closeDropdown();
          }
        });
      }

      function filterRecipes(category) {
        currentFilter = category;
        document.getElementById("currentFilterLabel").textContent =
          category === "Alla" ? "Alla" : translateCategory(category);

        document.querySelectorAll(".filter-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.category === category);
        });
        const accordion = document.getElementById("categoryAccordion");
        if (accordion && accordion.open) {
          accordion.open = false;
        }

        const searchTerm = document
          .getElementById("searchInput")
          .value.toLowerCase();
        filterAndDisplay(searchTerm);
      }

      function filterAndDisplay(searchTerm) {
        let filtered = recipes;

        if (currentFilter !== "Alla") {
          filtered = filtered.filter((r) =>
            getRecipeCategories(r).includes(currentFilter),
          );
        }

        if (searchTerm) {
          filtered = filtered.filter(
            (r) =>
              r.title.toLowerCase().includes(searchTerm) ||
              r.description.toLowerCase().includes(searchTerm) ||
              getRecipeCategories(r)
                .join(" ")
                .toLowerCase()
                .includes(searchTerm) ||
              getRecipeCategoryLabels(r)
                .join(" ")
                .toLowerCase()
                .includes(searchTerm),
          );
        }

        displayRecipes(getSortedRecipes(filtered));
      }

      function displayRecipes(recipesToShow) {
        const grid = document.getElementById("recipesGrid");
        const noResults = document.getElementById("noResults");

        if (recipesToShow.length === 0) {
          grid.style.display = "none";
          noResults.style.display = "block";
          return;
        }

        grid.style.display = "grid";
        noResults.style.display = "none";
        grid.innerHTML = "";

        recipesToShow.forEach((recipe) => {
          const card = document.createElement("div");
          card.className = "recipe-card";
          card.onclick = () => openModal(recipe);
          const categoryBadges = getRecipeCategoryLabels(recipe)
            .map((cat) => `<span class="recipe-category">${cat}</span>`)
            .join("");

          card.innerHTML = `
                    <img class="recipe-image" src="${recipe.image}" alt="${recipe.title}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/400x300?text=Recipe+Image'">
                    <div class="recipe-content">
                        <div class="recipe-categories">${categoryBadges}</div>
                        <h3 class="recipe-title">${recipe.title}</h3>
                        <p class="recipe-description">${recipe.description}</p>
                        <div class="recipe-meta">
                            <span><img src="images/clock.png" width="18"> ${recipe.time}</span>
                            <span><img src="images/food.png" width="18"> ${getPortionLabel(recipe)}</span>
                        </div>
                    </div>
                `;

          grid.appendChild(card);
        });
      }

      function openModal(recipe) {
        document.getElementById("modalImage").src = recipe.image;
        document.getElementById("modalCategory").innerHTML =
          getRecipeCategoryLabels(recipe)
            .map((cat) => `<span class="recipe-category">${cat}</span>`)
            .join("");
        document.getElementById("modalTitle").textContent = recipe.title;
        document.getElementById("modalDescription").textContent =
          recipe.description;
        document.getElementById("modalTime").textContent = recipe.time;
        document.getElementById("modalServings").textContent =
          getPortionLabel(recipe);
        document.getElementById("modalDateAdded").textContent = formatAddedDate(
          recipe.dateAdded,
        );

        // Prepare scalable ingredients
        const ingredientsList = document.getElementById("modalIngredients");
        ingredientsList.innerHTML = "";

        // Helpers to parse and format quantities
        function parseIngredient(str) {
          // Matches: "1 1/2", "1/2", "2.5", "200g" (200 + g), or "2"
          const regex =
            /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)([^\s]*)\s*(.*)$/;
          const m = str.match(regex);
          if (!m) return { original: str, amount: null };
          const amtText = m[1];
          const unitAttached = m[2] || "";
          const rest = m[3] || "";
          let amount = 0;
          if (amtText.includes(" ") && amtText.includes("/")) {
            const [whole, frac] = amtText.split(" ");
            const [num, den] = frac.split("/");
            amount = parseFloat(whole) + parseFloat(num) / parseFloat(den);
          } else if (amtText.includes("/")) {
            const [num, den] = amtText.split("/");
            amount = parseFloat(num) / parseFloat(den);
          } else {
            amount = parseFloat(amtText);
          }
          return { original: str, amount, unitAttached, rest };
        }

        function formatAmount(n) {
          if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
          // Use up to 2 decimals for clarity
          let s = n.toFixed(2);
          s = s.replace(/\.00$/, "");
          s = s.replace(/(\.[0-9]*?)0+$/, "$1");
          return s;
        }

        const parsedIngredients = recipe.ingredients.map(parseIngredient);

        let scale = 1; // 1 = original size
        const minScale = 0.25; // don't scale below 25%
        const canScale = isPortionBased(recipe);

        function renderIngredients() {
          ingredientsList.innerHTML = "";
          parsedIngredients.forEach((p) => {
            const li = document.createElement("li");
            if (p.amount == null) {
              li.textContent = p.original;
            } else {
              const newAmt = p.amount * scale;
              let text = "";
              if (p.unitAttached) {
                // e.g. 200g
                text = `${formatAmount(newAmt)}${p.unitAttached}${
                  p.rest ? " " + p.rest : ""
                }`;
              } else {
                text = `${formatAmount(newAmt)} ${p.rest}`.trim();
              }
              li.textContent = text;
            }
            ingredientsList.appendChild(li);
          });

          // Update servings display
          document.getElementById("modalServings").textContent =
            getPortionLabel(recipe, canScale ? scale : 1);
        }

        // Init render
        renderIngredients();

        // Wire up portion buttons
        const incBtn = document.getElementById("increasePortion");
        const decBtn = document.getElementById("decreasePortion");
        incBtn.disabled = !canScale;
        decBtn.disabled = !canScale;
        incBtn.style.opacity = canScale ? "1" : "0.4";
        decBtn.style.opacity = canScale ? "1" : "0.4";
        incBtn.style.cursor = canScale ? "pointer" : "not-allowed";
        decBtn.style.cursor = canScale ? "pointer" : "not-allowed";

        // Change scale by +/-0.5 (50% of original servings) per click for clearer behavior
        incBtn.onclick = () => {
          if (!canScale) return;
          scale = scale + 0.5;
          renderIngredients();
        };

        decBtn.onclick = () => {
          if (!canScale) return;
          const newScale = scale - 0.5;
          if (newScale < minScale) return; // don't go below minimum
          scale = newScale;
          renderIngredients();
        };

        const instructionsList = document.getElementById("modalInstructions");
        instructionsList.innerHTML = "";
        recipe.instructions.forEach((inst) => {
          const li = document.createElement("li");
          li.textContent = inst;
          instructionsList.appendChild(li);
        });

        document.getElementById("recipeModal").classList.add("active");
        document.body.style.overflow = "hidden";
      }

      function closeModal() {
        document.getElementById("recipeModal").classList.remove("active");
        document.body.style.overflow = "auto";
      }

      document.getElementById("searchInput").addEventListener("input", (e) => {
        filterAndDisplay(e.target.value.toLowerCase());
      });
      document.getElementById("sortSelect").addEventListener("change", (e) => {
        currentSort = e.target.value;
        filterAndDisplay(
          document.getElementById("searchInput").value.toLowerCase(),
        );
      });

      document.getElementById("recipeModal").addEventListener("click", (e) => {
        if (e.target.id === "recipeModal") {
          closeModal();
        }
      });

      init();
