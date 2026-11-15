import './style.css';

import type { ViewerHandle } from '@playcanvas/supersplat-viewer/viewer';

import { mountAdmin } from './admin';
import { mountPlanControls } from './plan-controls';
import { listTours, loadTour } from './tours';
import { mountTour } from './viewer';

// Routes:  /              list of tours
//          /<tour>        the walk-through
//          /<tour>/admin  the walk-through with the settings panel (dev server only: it saves files)

const app = document.getElementById('app')!;

const showLoading = (viewer: ViewerHandle, host: HTMLElement) => {
    const bar = document.createElement('div');
    bar.className = 'loading';
    bar.innerHTML = '<span></span>';
    host.append(bar);
    const fill = bar.firstElementChild as HTMLElement;
    const update = (progress: number) => (fill.style.width = `${Math.max(5, progress)}%`);
    update(viewer.state.progress ?? 0);
    viewer.events.on('progress:changed', update);
    const done = () => bar.classList.add('done');
    if (viewer.state.loaded) done();
    else viewer.events.once('loaded:changed', done);
};

const renderMessage = (title: string, text: string) => {
    app.innerHTML = '';
    const main = document.createElement('main');
    main.className = 'page';
    main.innerHTML = `<h1></h1><p></p><p><a href="/">All tours</a></p>`;
    main.querySelector('h1')!.textContent = title;
    main.querySelector('p')!.textContent = text;
    app.append(main);
};

const renderIndex = async () => {
    document.title = 'Tours';
    const tours = await listTours();
    app.innerHTML = '';
    const main = document.createElement('main');
    main.className = 'page';
    main.innerHTML = '<h1>Tours</h1><ul class="tour-list"></ul>';
    const list = main.querySelector('ul')!;
    for (const tour of tours) {
        const li = document.createElement('li');
        li.innerHTML = `<a class="title"></a><a class="admin">Settings</a>`;
        const [open, admin] = li.querySelectorAll('a');
        open.textContent = tour.title;
        open.href = `/${tour.name}`;
        admin.href = `/${tour.name}/admin`;
        list.append(li);
    }
    app.append(main);
};

const renderTour = async (name: string, admin: boolean) => {
    const tour = await loadTour(name);
    if (!tour) {
        renderMessage('Tour not found', `There is no tour called "${name}".`);
        return;
    }
    document.title = admin ? `${tour.title} · settings` : tour.title;

    app.innerHTML = '';
    const layout = document.createElement('div');
    layout.className = admin ? 'layout admin' : 'layout';
    const stage = document.createElement('div');
    stage.className = 'stage';
    layout.append(stage);
    app.append(layout);

    let panel: HTMLElement | null = null;
    if (admin) {
        panel = document.createElement('aside');
        panel.className = 'panel';
        layout.append(panel);
    }

    const viewer = await mountTour(stage, tour);
    showLoading(viewer, stage);
    const planControls = mountPlanControls(stage, viewer);
    if (panel) mountAdmin(panel, name, tour, viewer, stage, planControls);
};

const route = async () => {
    const parts = location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    try {
        if (parts.length === 0) return await renderIndex();
        if (parts.length === 1) return await renderTour(parts[0], false);
        if (parts.length === 2 && parts[1] === 'admin') {
            if (!import.meta.env.DEV) {
                return renderMessage('Settings unavailable', 'Tour settings can only be edited on the dev server.');
            }
            return await renderTour(parts[0], true);
        }
        renderMessage('Page not found', location.pathname);
    } catch (err) {
        renderMessage('Something went wrong', (err as Error).message);
    }
};

route();
