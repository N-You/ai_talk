/// <reference types="@dcloudio/types" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "@dcloudio/uni-app" {
  interface Uni {
    $u: any;
  }
}
