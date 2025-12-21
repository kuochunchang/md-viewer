import '@mdi/font/css/materialdesignicons.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import './styles/main.scss'
import './styles/preview.scss'

const app = createApp(App)

app.use(createPinia())
app.use(vuetify)

app.mount('#app')
