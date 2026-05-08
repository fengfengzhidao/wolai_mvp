<script setup>
import { computed } from "vue";

const props = defineProps({
  icon: {
    type: Object,
    default: null,
  },
  size: {
    type: String,
    default: "small",
  },
});

const calendarDate = computed(() => {
  const date = parseLocalDate(props.icon?.date);

  return Number.isNaN(date.getTime()) ? new Date() : date;
});

const monthLabel = computed(() =>
  `${calendarDate.value.getMonth() + 1}月`,
);
const dayLabel = computed(() => String(calendarDate.value.getDate()));
const weekdayLabel = computed(() =>
  ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][calendarDate.value.getDay()],
);
const accentColor = computed(() => props.icon?.color || "#a36f92");

function parseLocalDate(value) {
  if (typeof value !== "string") {
    return new Date();
  }

  const [year, month, date] = value.split("-").map(Number);

  if (!year || !month || !date) {
    return new Date(value);
  }

  return new Date(year, month - 1, date);
}
</script>

<template>
  <span
    class="calendar-page-icon"
    :class="`is-${size}`"
    :style="{ '--calendar-accent': accentColor }"
    aria-hidden="true"
  >
    <span class="calendar-page-icon-header">
      <span>{{ monthLabel }}</span>
      <span class="calendar-page-icon-dots">•••</span>
    </span>
    <span class="calendar-page-icon-body">
      <span class="calendar-page-icon-day">{{ dayLabel }}</span>
      <span class="calendar-page-icon-weekday">{{ weekdayLabel }}</span>
    </span>
  </span>
</template>
