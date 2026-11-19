import { STORAGE_KEY } from './themes'

/**
 * The script that goes in the head, before the body: it applies the stored scheme to <html> before the
 * first paint. Given the two class strings that `themeClass` made.
 */
export function bootScript(lightClass: string, darkClass: string): string {
  return `try{var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(s==='dark'){document.documentElement.className=${JSON.stringify(darkClass)}}else{document.documentElement.className=${JSON.stringify(lightClass)}}}catch(e){}`
}
