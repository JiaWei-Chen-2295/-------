import { createApp } from "vue";
import Antd from "ant-design-vue";

import App from "./App.vue";
import AdminApp from "./AdminApp.vue";
import "ant-design-vue/dist/reset.css";
import "./styles.css";

const rootComponent = window.location.pathname.startsWith("/admin") ? AdminApp : App;

createApp(rootComponent).use(Antd).mount("#app");
