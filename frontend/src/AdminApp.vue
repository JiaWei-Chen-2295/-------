<script setup>
import { computed, ref } from "vue";
import { message } from "ant-design-vue";

import { assetUrl, listAdminReports } from "./api/client.js";

const secret = ref(window.sessionStorage.getItem("lab-report-admin-secret") || "");
const loading = ref(false);
const items = ref([]);
const errorMessage = ref("");
const filters = ref({
  course: "",
  name: "",
  studentId: "",
  fromDate: "",
  toDate: ""
});

const columns = [
  { title: "生成时间", dataIndex: "createdAt", key: "createdAt", width: 190 },
  { title: "课程", dataIndex: ["form", "course"], key: "course", width: 120 },
  { title: "实验项目", dataIndex: ["form", "project"], key: "project", width: 160 },
  { title: "系部", dataIndex: ["form", "department"], key: "department", width: 120 },
  { title: "年级", dataIndex: ["form", "grade"], key: "grade", width: 80 },
  { title: "姓名", dataIndex: ["form", "name"], key: "name", width: 90 },
  { title: "学号", dataIndex: ["form", "studentId"], key: "studentId", width: 120 },
  { title: "日期", dataIndex: ["form", "date"], key: "date", width: 120 },
  { title: "块数量", dataIndex: "blocks", key: "blocks", width: 90 }
];

const canLoad = computed(() => secret.value.trim().length > 0);
const filteredItems = computed(() => {
  const course = filters.value.course.trim().toLowerCase();
  const name = filters.value.name.trim().toLowerCase();
  const studentId = filters.value.studentId.trim().toLowerCase();
  const fromDate = filters.value.fromDate;
  const toDate = filters.value.toDate;

  return items.value.filter((item) => {
    const recordCourse = String(item.form?.course ?? "").toLowerCase();
    const recordName = String(item.form?.name ?? "").toLowerCase();
    const recordStudentId = String(item.form?.studentId ?? "").toLowerCase();
    const createdAt = new Date(item.createdAt).getTime();

    if (course && !recordCourse.includes(course)) {
      return false;
    }
    if (name && !recordName.includes(name)) {
      return false;
    }
    if (studentId && !recordStudentId.includes(studentId)) {
      return false;
    }

    if (fromDate) {
      const fromTime = new Date(`${fromDate}T00:00:00`).getTime();
      if (!Number.isNaN(createdAt) && createdAt < fromTime) {
        return false;
      }
    }
    if (toDate) {
      const toTime = new Date(`${toDate}T23:59:59.999`).getTime();
      if (!Number.isNaN(createdAt) && createdAt > toTime) {
        return false;
      }
    }

    return true;
  });
});
const dataSource = computed(() =>
  filteredItems.value.map((item, index) => ({
    ...item,
    key: item.id || `${item.createdAt || "unknown"}-${index}`
  }))
);

function formatTime(value) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function resolveDownloadUrl(row) {
  if (!row.docxDownloadUrl) {
    return "";
  }
  return assetUrl(row.docxDownloadUrl);
}

function resetFilters() {
  filters.value = {
    course: "",
    name: "",
    studentId: "",
    fromDate: "",
    toDate: ""
  };
}

async function fetchReports() {
  const trimmedSecret = secret.value.trim();
  if (!trimmedSecret) {
    message.warning("请先输入管理员密钥");
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const data = await listAdminReports(trimmedSecret);
    items.value = Array.isArray(data.items) ? data.items : [];
    window.sessionStorage.setItem("lab-report-admin-secret", trimmedSecret);
    message.success(`已加载 ${items.value.length} 条记录`);
  } catch (error) {
    errorMessage.value = error.message;
    message.error(error.message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="shell admin-shell">
    <section class="panel admin-panel">
      <div class="panel-header panel-header-inline">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>报告生成记录</h2>
          <span>仅管理员可查看全部生成信息，并下载文档。</span>
        </div>
        <a href="/" class="admin-back-link">返回普通页面</a>
      </div>

      <div class="admin-toolbar">
        <a-input-password
          :value="secret"
          placeholder="输入管理员密钥（ADMIN_SECRET）"
          class="admin-secret-input"
          @update:value="secret = $event"
          @press-enter="fetchReports"
        />
        <a-button type="primary" :loading="loading" :disabled="!canLoad" @click="fetchReports">
          刷新记录
        </a-button>
      </div>

      <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" />

      <div class="admin-filter-panel">
        <a-input
          :value="filters.course"
          placeholder="按课程筛选"
          allow-clear
          @update:value="filters.course = $event"
        />
        <a-input
          :value="filters.name"
          placeholder="按姓名筛选"
          allow-clear
          @update:value="filters.name = $event"
        />
        <a-input
          :value="filters.studentId"
          placeholder="按学号筛选"
          allow-clear
          @update:value="filters.studentId = $event"
        />
        <a-input
          :value="filters.fromDate"
          type="date"
          placeholder="开始日期"
          @update:value="filters.fromDate = $event"
        />
        <a-input
          :value="filters.toDate"
          type="date"
          placeholder="结束日期"
          @update:value="filters.toDate = $event"
        />
        <a-button @click="resetFilters">清空筛选</a-button>
      </div>

      <div class="admin-filter-summary">
        当前显示 {{ dataSource.length }} 条 / 总计 {{ items.length }} 条
      </div>

      <a-table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="{ pageSize: 10, showSizeChanger: false }"
        size="middle"
        bordered
        class="admin-table"
        :scroll="{ x: 1250 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'blocks'">
            {{ record.blocks ?? "--" }}
          </template>
        </template>

        <template #expandedRowRender="{ record }">
          <div class="admin-row-actions">
            <a
              v-if="resolveDownloadUrl(record)"
              :href="resolveDownloadUrl(record)"
              target="_blank"
              rel="noreferrer"
            >
              下载 DOCX
            </a>
            <span v-else>无可用下载链接</span>
          </div>
        </template>
      </a-table>
    </section>
  </div>
</template>
