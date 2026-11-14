import { createViewer } from '@playcanvas/supersplat-viewer/viewer';
import type { ViewerHandle } from '@playcanvas/supersplat-viewer/viewer';
import '@playcanvas/supersplat-viewer/viewer.css';

import type { Tour } from './tours';

/** Mount a walk-only tour, without the stock viewer buttons, into `container`. */
const mountTour = (container: HTMLElement, tour: Tour): Promise<ViewerHandle> =>
    createViewer({
        container,
        settings: structuredClone(tour.viewer),
        contentUrl: tour.content,
        collisionUrl: tour.collision ?? undefined,
        aa: tour.aa,
        ui: false,
        walkOnly: true,
        walk: tour.walk
    });

export { mountTour };
