import { goto } from '$app/navigation';

export function storeLastPageAndGoto(url: string) {
	sessionStorage.setItem('lastPage', window.location.pathname + window.location.search);
	goto(url);
}
