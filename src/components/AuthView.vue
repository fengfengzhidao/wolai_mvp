<script setup>
import { computed, ref } from "vue";

const emit = defineEmits(["login", "register"]);

const mode = ref("login");
const username = ref("");
const password = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);

const title = computed(() => (mode.value === "login" ? "登录 wolai_mvp" : "注册账号"));
const submitText = computed(() => (mode.value === "login" ? "登录" : "注册并进入"));
const switchText = computed(() =>
  mode.value === "login" ? "还没有账号？注册" : "已有账号？登录",
);

function switchMode() {
  mode.value = mode.value === "login" ? "register" : "login";
  errorMessage.value = "";
}

async function submitAuth() {
  if (isSubmitting.value) {
    return;
  }

  errorMessage.value = "";
  const trimmedUsername = username.value.trim();

  if (!trimmedUsername || password.value.length < 6) {
    errorMessage.value = "请输入用户名，密码至少 6 位";
    return;
  }

  isSubmitting.value = true;
  try {
    await new Promise((resolve, reject) => {
      emit(mode.value, {
        username: trimmedUsername,
        password: password.value,
        resolve,
        reject,
      });
    });
  } catch (error) {
    errorMessage.value = error?.message || "操作失败";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <main class="auth-shell">
    <section class="auth-panel" aria-label="用户认证">
      <p class="auth-kicker">个人笔记工作台</p>
      <h1>{{ title }}</h1>
      <form class="auth-form" @submit.prevent="submitAuth">
        <label class="auth-field">
          <span>用户名</span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
          />
        </label>
        <label class="auth-field">
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            placeholder="至少 6 位"
          />
        </label>
        <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
        <button class="auth-submit" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? "处理中..." : submitText }}
        </button>
      </form>
      <button class="auth-switch" type="button" @click="switchMode">
        {{ switchText }}
      </button>
    </section>
  </main>
</template>
