import { createSSRApp } from 'vue'
import { createApp } from './app'
import './style'

createSSRApp(createApp(window.location.pathname)).mount('#root')
