<script setup>
const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(["update:modelValue"]);

function updateField(field, value) {
  emit("update:modelValue", {
    ...props.modelValue,
    [field]: value
  });
}
</script>

<template>
  <section class="panel report-form">
    <div class="panel-header">
      <p class="eyebrow">Cover Form</p>
      <h2>报告封面信息</h2>
      <span>先填表单，再编写正文。</span>
    </div>
    <a-form layout="vertical">
      <div class="form-grid">
        <a-form-item label="课程名称">
          <a-input :value="modelValue.course" placeholder="例如：操作系统" @update:value="updateField('course', $event)" />
        </a-form-item>
        <a-form-item label="实验项目">
          <a-input :value="modelValue.project" placeholder="例如：进程调度实验" @update:value="updateField('project', $event)" />
        </a-form-item>
        <a-form-item label="系部">
          <a-input :value="modelValue.department" placeholder="例如：计算机系" @update:value="updateField('department', $event)" />
        </a-form-item>
        <a-form-item label="年级">
          <a-input :value="modelValue.grade" placeholder="例如：2022" @update:value="updateField('grade', $event)" />
        </a-form-item>
        <a-form-item label="姓名">
          <a-input :value="modelValue.name" placeholder="例如：张三" @update:value="updateField('name', $event)" />
        </a-form-item>
        <a-form-item label="学号">
          <a-input :value="modelValue.studentId" placeholder="例如：20220001" @update:value="updateField('studentId', $event)" />
        </a-form-item>
      </div>
      <a-form-item label="日期">
        <a-input :value="modelValue.date" placeholder="YYYY-MM-DD" @update:value="updateField('date', $event)" />
      </a-form-item>
    </a-form>
  </section>
</template>
