'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root = document.documentElement;

const getJSON = async p => {
    const r = await fetch(p);
    if (!r.ok) throw new Error(p + ' → ' + r.status);
    return r.json();
};

const state = {
    config: {},
    categories: [],
    filters: { category: 'all', q: '' }
};

/* ============ СТАРТ ============ */
(async function boot() {
    initTheme();
    initMobileMenu();

    try {
        const data = await getJSON('data/projects.json');
        state.config = data.config || {};
        state.categories = data.categories || [];

        buildStatic();
        buildCategoryFilters();
        renderCatalog();
    } catch (e) {
        console.error(e);
        $('#catalog').innerHTML =
            `<div class="empty-state">Ошибка загрузки данных: ${esc(e.message)}<br>
            Если вы открыли файл двойным кликом — запустите локальный сервер.</div>`;
    }
})();

/* ============ ТЕМА ============ */
function initTheme() {
    const saved = localStorage.getItem('vireist-theme');
    if (saved) setTheme(saved, true);
    $('#theme-btn').addEventListener('click', () =>
        setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
}

function setTheme(t, silent) {
    const animate = !silent && matchMedia('(prefers-reduced-motion: no-preference)').matches;
    if (animate) root.classList.add('theme-anim');
    root.dataset.theme = t;
    if (!silent) localStorage.setItem('vireist-theme', t);
    $('#theme-btn').textContent = t === 'dark' ? '☀' : '☾';
    if (animate) {
        clearTimeout(setTheme._t);
        setTheme._t = setTimeout(() => root.classList.remove('theme-anim'), 500);
    }
}

/* ============ МОБИЛЬНОЕ МЕНЮ ============ */
function initMobileMenu() {
    const drawer = $('#nav-drawer');
    const backdrop = $('#nav-backdrop');
    $('#nav-drawer-list').innerHTML = $('#main-nav').innerHTML;

    const open = () => {
        drawer.classList.add('open');
        backdrop.classList.add('open');
        document.body.classList.add('no-scroll');
        drawer.setAttribute('aria-hidden', 'false');
    };
    const close = () => {
        drawer.classList.remove('open');
        backdrop.classList.remove('open');
        document.body.classList.remove('no-scroll');
        drawer.setAttribute('aria-hidden', 'true');
    };

    $('#nav-open').addEventListener('click', open);
    $('#nav-close').addEventListener('click', close);
    backdrop.addEventListener('click', close);
    drawer.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* ============ СТАТИКА ============ */
function buildStatic() {
    const c = state.config;
    $('#logo-nick').textContent = c.nick || 'VIREIST';
    $('#logo-sub').textContent = c.subtitle || 'МАТЕРИАЛЫ';
    $('#hero-overline').textContent = c.overline || '';
    $('#hero-text').textContent = c.heroText || '';

    // Статистика
    const totalProjects = state.categories.reduce((sum, cat) => sum + cat.projects.length, 0);
    const totalCategories = state.categories.length;

    $('#stats').innerHTML = `
        <div class="stat"><b>${totalProjects}</b><span>проектов</span></div>
        <div class="stat"><b>${totalCategories}</b><span>категорий</span></div>
        <div class="stat"><b>${getActiveProjectsCount()}</b><span>активных</span></div>
    `;

    $('#projects-count').textContent = 'Всего проектов: ' + totalProjects;
    $('#projects-note').textContent = c.heroText || '';

    $('#year').textContent = new Date().getFullYear();
    $('#footer-nick').textContent = c.nick || 'VIREIST';
    $('#license-line').textContent = c.licenseNote ||
        'Материалы публикуются под лицензией CC BY-NC-SA 4.0: делитесь и адаптируйте для своих игр с указанием автора, без коммерческого использования.';
}

function getActiveProjectsCount() {
    return state.categories.reduce((sum, cat) =>
        sum + cat.projects.filter(p => p.status === 'active').length, 0);
}

/* ============ ФИЛЬТРЫ ПО КАТЕГОРИЯМ ============ */
function buildCategoryFilters() {
    const container = $('#category-filters');

    // Кнопка "Все"
    let html = `<button class="chip active" data-category="all">Все</button>`;

    // Кнопки для каждой категории
    state.categories.forEach(cat => {
        html += `<button class="chip" data-category="${esc(cat.id)}">
            ${cat.icon || ''} ${esc(cat.title)} (${cat.projects.length})
        </button>`;
    });

    container.innerHTML = html;

    // Обработчик кликов
    container.addEventListener('click', e => {
        const btn = e.target.closest('.chip');
        if (!btn) return;

        // Обновляем активную кнопку
        $$('#category-filters .chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');

        // Обновляем фильтр
        state.filters.category = btn.dataset.category;
        renderCatalog();
    });
}

/* ============ РЕНДЕР КАТАЛОГА ============ */
function renderCatalog() {
    const container = $('#catalog');
    const filteredProjects = getFilteredProjects();

    if (filteredProjects.length === 0) {
        container.innerHTML = `<div class="empty-state">Проектов не найдено.</div>`;
        return;
    }

    container.innerHTML = filteredProjects.map(projectCard).join('');

    // Клики по карточкам
    $$('.case-card').forEach(card => {
        card.addEventListener('click', () => {
            const url = card.dataset.url;
            if (url && url !== '#') location.href = url;
        });
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const url = card.dataset.url;
                if (url && url !== '#') location.href = url;
            }
        });
    });

    bindCoverErrors();
}

function getFilteredProjects() {
    const { category } = state.filters;

    let projects = [];
    state.categories.forEach(cat => {
        if (category === 'all' || category === cat.id) {
            projects = projects.concat(cat.projects.map(p => ({
                ...p,
                categoryId: cat.id,
                categoryTitle: cat.title
            })));
        }
    });

    return projects;
}

/* ============ КАРТОЧКА ПРОЕКТА ============ */
function projectCard(p) {
    const statusMap = {
        'active':   { label: 'Активен',      cls: '' },
        'in-dev':   { label: 'В разработке', cls: 'tag-warn' },
        'archived': { label: 'В архиве',     cls: '' },
        'planned':  { label: 'Запланирован', cls: '' }
    };
    const st = statusMap[p.status] || statusMap['active'];

    const coverHtml = p.cover
        ? `<div class="case-cover"><img src="${esc(p.cover)}" alt=""></div>`
        : `<div class="case-cover empty"></div>`;

    return `
    <article class="case-card" tabindex="0" role="link"
             aria-label="${esc(p.title)}"
             data-url="${esc(p.url)}">
        <div class="case-top">
            <span class="case-num">Проект № ${esc(p.num)}</span>
            <span class="price ${p.status === 'in-dev' ? 'paid' : 'free'}">${esc(p.type)}</span>
        </div>
        ${coverHtml}
        <div class="case-body">
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.description)}</p>
            <div class="meta">
                <span class="sys">${esc(p.categoryTitle)}</span>
            </div>
            <div class="tags">
                ${(p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
                <span class="tag ${st.cls}">${esc(st.label)}</span>
            </div>
        </div>
    </article>`;
}

function bindCoverErrors() {
    $$('.case-cover img').forEach(img =>
        img.addEventListener('error', () => {
            img.parentNode.classList.add('empty');
            img.remove();
        }));
}