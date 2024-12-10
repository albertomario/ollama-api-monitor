import { writable } from 'svelte/store';

const storedRequests = localStorage.getItem("requests");
const storedResponses = localStorage.getItem("responses");
const storedStats = localStorage.getItem("stats");

export const stores = writable({ requests: storedRequests ? JSON.parse(storedRequests) : {}, responses: storedResponses ? JSON.parse(storedResponses) : {}, stats: storedStats ? JSON.parse(storedStats) : {} });