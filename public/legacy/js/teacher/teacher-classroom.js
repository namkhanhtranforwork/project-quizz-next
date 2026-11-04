(function () {
  "use strict";
  window.TeacherViews = window.TeacherViews || {};

  function elementLabel(element) {
    return ({
      desk: element.deskType === "double" ? "Bàn đôi" : "Bàn đơn",
      teacher_desk: "Bàn giáo viên",
      board: "Bảng",
      door: "Cửa",
      window: "Cửa sổ",
      label: element.text || "Ghi chú"
    })[element.type] || element.type;
  }

  function renderElement(element, layout, state, esc, visibleStudentIds = null) {
    const fill = element.type === "desk" ? "#dff2c4" :
      element.type === "board" ? "#1f8a4c" :
      element.type === "teacher_desk" ? "#ffe9a8" : "#eef6e8";
    const textFill = element.type === "board" ? "#fff" : "#1d3326";
    const seats = (element.seats || []).map((seat, index) => {
      const count = element.seats.length;
      const cx = element.width * (index + 1) / (count + 1);
      const student = state.users.find(user => user.id === seat.studentId);
      const label = !student ? "Trống" : visibleStudentIds && !visibleStudentIds.has(student.id) ? "Đã xếp" : student.name;
      return `<g><circle cx="${cx}" cy="${element.height - 12}" r="8" fill="${student ? "#1f8a4c" : "#fff"}" stroke="#1d3326"/><text x="${cx}" y="${element.height + 16}" text-anchor="middle" font-size="10" fill="${textFill}">${esc(label)}</text></g>`;
    }).join("");
    const label = element.type === "label" ? element.text : elementLabel(element);
    return `<g data-layout-element="${esc(element.id)}" transform="translate(${element.x} ${element.y}) rotate(${Number(element.rotation) || 0} ${element.width / 2} ${element.height / 2})" class="classroom-element">
      <rect width="${element.width}" height="${element.height}" rx="7" fill="${fill}" stroke="#31533b" stroke-width="2"/>
      <text x="${element.width / 2}" y="${element.type === "desk" ? 22 : element.height / 2 + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="${textFill}">${esc(label)}</text>
      ${seats}
    </g>`;
  }

  function renderClassroomSvg(layout, state, esc, visibleStudentIds = null) {
    const cls = (state.classes || []).find(item => item.id === layout.classId);
    return `<svg class="classroom-canvas" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Sơ đồ ${esc(cls?.name || "lớp học")}">
      <rect width="${layout.width}" height="${layout.height}" fill="#fffef8" stroke="#bdd8bf"/>
      ${layout.elements.map(element => renderElement(element, layout, state, esc, visibleStudentIds)).join("")}
    </svg>`;
  }
  window.TeacherViews.renderClassroomSvg = renderClassroomSvg;

  window.TeacherViews.classroom = function (ctx) {
    const { state, esc, classes, session, uiState } = ctx;
    const classId = uiState.teacherLayoutClassId || ctx.classId || classes[0]?.id || "";
    const cls = classes.find(item => item.id === classId) || classes[0];
    const classLayouts = cls ? state.classroomLayouts.filter(item => item.classId === cls.id) : [];
    let layout = classLayouts.find(item => item.id === uiState.teacherLayoutId);
    if (!layout) layout = classLayouts.find(item => item.status === "active") || classLayouts[0] || null;
    if (layout) uiState.teacherLayoutId = layout.id;
    const canManageClass = Boolean(cls && window.Core?.canEditClassroom(state, session, cls.id));
    const parentCanView = Boolean(cls && window.Core?.isParentClassroomVisible(state, cls.id));
    const canEdit = Boolean(layout ? window.Core?.canEditLayout(state, session, layout) : canManageClass);
    const studentIds = cls ? window.Core.getClassStudentIds(state, cls.id) : [];
    const students = state.users.filter(user => studentIds.includes(user.id) && user.role === "student" && user.active !== false);
    const seatedIds = new Set((layout?.elements || []).flatMap(element => element.seats || []).map(seat => seat.studentId).filter(Boolean));
    const svg = layout ? renderClassroomSvg(layout, state, esc) : '<div class="empty">Tạo một sơ đồ để bắt đầu sắp xếp lớp học.</div>';

    return `<section class="card">
      <div class="row"><div><h2>Sơ đồ lớp học</h2><p class="muted">GVCN có thể chỉnh sửa sơ đồ và sắp xếp chỗ ngồi. Giáo viên bộ môn chỉ được xem; Admin có quyền quản trị.</p></div>${cls ? `<span class="pill">${esc(cls.name)}</span>` : ""}</div>
      ${classes.length ? `<div class="form-grid"><div><label for="classroom-class-select">Lớp</label><select id="classroom-class-select" data-classroom-class>${classes.map(item => `<option value="${esc(item.id)}" ${item.id === cls?.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></div>
      ${classLayouts.length ? `<div><label for="classroom-layout-select">Sơ đồ</label><select id="classroom-layout-select" data-layout-select>${classLayouts.map(item => `<option value="${esc(item.id)}" ${item.id === layout?.id ? "selected" : ""}>${esc(item.name)}${item.status === "active" ? " · Đang dùng" : " · Lưu trữ"}</option>`).join("")}</select></div>` : ""}</div>
      ${canManageClass && cls ? `<div class="row classroom-parent-sharing"><div><b>Phụ huynh xem sơ đồ</b><p class="muted">${parentCanView ? "Phụ huynh đã liên kết và xác minh được xem sơ đồ lớp ở chế độ chỉ đọc." : "Sơ đồ lớp này hiện không hiển thị trong cổng phụ huynh."}</p></div><div><span class="pill ${parentCanView ? "" : "off"}">${parentCanView ? "Đang bật" : "Đang tắt"}</span><button type="button" class="small ${parentCanView ? "secondary" : ""}" data-action="toggle-parent-classroom" data-class-id="${esc(cls.id)}" aria-pressed="${parentCanView}">${parentCanView ? "Tắt xem sơ đồ" : "Bật xem sơ đồ"}</button></div></div>` : ""}
      ${canManageClass && cls ? `<form id="classroom-create-form" class="form-grid"><input type="hidden" name="classId" value="${esc(cls.id)}"><div><label for="classroom-layout-name">Tên sơ đồ mới</label><input id="classroom-layout-name" name="name" required maxlength="100" placeholder="Ví dụ: Học kỳ 1"></div><div><label for="classroom-width">Chiều rộng</label><input id="classroom-width" name="width" type="number" min="400" max="3000" value="1200"></div><div><label for="classroom-height">Chiều cao</label><input id="classroom-height" name="height" type="number" min="300" max="2000" value="800"></div><div class="actions"><button type="submit">Tạo sơ đồ mới</button></div></form>` : ""}
      ${layout ? `<div class="classroom-toolbar">${canEdit ? `<button class="small secondary" data-action="layout-add-element" data-type="desk" data-desk-type="single">+ Bàn đơn</button><button class="small secondary" data-action="layout-add-element" data-type="desk" data-desk-type="double">+ Bàn đôi</button><button class="small secondary" data-action="layout-add-element" data-type="teacher_desk">+ Bàn giáo viên</button><button class="small secondary" data-action="layout-add-element" data-type="board">+ Bảng</button><button class="small secondary" data-action="layout-add-element" data-type="door">+ Cửa</button><button class="small secondary" data-action="layout-add-element" data-type="window">+ Cửa sổ</button><button class="small secondary" data-action="layout-add-element" data-type="label">+ Nhãn</button>` : '<span class="notice info">Chế độ chỉ xem</span>'}</div>
        <div class="classroom-canvas-wrap" data-layout-id="${esc(layout.id)}">${svg}</div>
        <div class="row classroom-summary"><span>${layout.elements.filter(element => element.type === "desk").length} bàn</span><span>${seatedIds.size}/${students.length} học sinh đã xếp</span><span>Phiên bản ${layout.version}</span></div>
        ${layout.elements.length ? `<div class="classroom-element-list">${layout.elements.map(element => `<div class="classroom-element-row"><div><b>${esc(elementLabel(element))}</b><span class="smalltext"> · (${Math.round(element.x)}, ${Math.round(element.y)})${element.seats?.length ? ` · ${element.seats.filter(seat => seat.studentId).length}/${element.seats.length} ghế` : ""}</span></div>${canEdit ? `<button class="small ghost" data-action="layout-rotate-element" data-layout-id="${esc(layout.id)}" data-id="${esc(element.id)}">Xoay 90°</button><button class="small danger" data-action="layout-remove-element" data-layout-id="${esc(layout.id)}" data-id="${esc(element.id)}">Xóa</button>` : ""}${(element.seats || []).map(seat => `<div class="seat-assignment"><label for="seat-${esc(seat.id)}">Ghế ${seat.position + 1} · ${esc(elementLabel(element))}</label><select id="seat-${esc(seat.id)}" data-seat-assignment data-layout-id="${esc(layout.id)}" data-seat-id="${esc(seat.id)}" ${canEdit ? "" : "disabled"}><option value="">Ghế trống</option>${students.map(student => `<option value="${esc(student.id)}" ${seat.studentId === student.id ? "selected" : ""}>${esc(student.name)}</option>`).join("")}</select></div>`).join("")}</div>`).join("")}</div>` : ""}
        ${students.length ? `<p class="smalltext">Chưa xếp: ${students.filter(student => !seatedIds.has(student.id)).map(student => esc(student.name)).join(", ") || "Không có"}</p>` : '<p class="smalltext">Lớp chưa có học sinh.</p>'}
      ` : ""}
      ` : '<div class="empty">Bạn chưa được phân công lớp nào.</div>'}
    </section>`;
  };

  window.TeacherViews.bindClassroom = function (ctx) {
    const svg = ctx.app.querySelector(".classroom-canvas");
    const wrap = ctx.app.querySelector(".classroom-canvas-wrap");
    if (!svg || !wrap || !window.Core.canEditLayout(ctx.state, ctx.session,
      ctx.state.classroomLayouts.find(item => item.id === wrap.dataset.layoutId))) return;
    let drag = null;
    svg.addEventListener("pointerdown", event => {
      const elementNode = event.target.closest("[data-layout-element]");
      if (!elementNode) return;
      const layout = ctx.state.classroomLayouts.find(item => item.id === wrap.dataset.layoutId);
      const element = layout?.elements.find(item => item.id === elementNode.dataset.layoutElement);
      if (!element) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const position = point.matrixTransform(svg.getScreenCTM().inverse());
      drag = { id: element.id, startX: position.x, startY: position.y, x: element.x, y: element.y, node: elementNode };
      svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    svg.addEventListener("pointermove", event => {
      if (!drag) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const position = point.matrixTransform(svg.getScreenCTM().inverse());
      const x = drag.x + position.x - drag.startX;
      const y = drag.y + position.y - drag.startY;
      drag.node.setAttribute("transform", `translate(${x} ${y})`);
    });
    svg.addEventListener("pointerup", event => {
      if (!drag) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const position = point.matrixTransform(svg.getScreenCTM().inverse());
      const x = drag.x + position.x - drag.startX;
      const y = drag.y + position.y - drag.startY;
      const { id } = drag;
      drag = null;
      try {
        window.Core.moveLayoutElement(ctx.state, ctx.session, wrap.dataset.layoutId, id, x, y);
        ctx.persist();
        ctx.log("MOVE_CLASSROOM_ELEMENT", { layoutId: wrap.dataset.layoutId, elementId: id, x, y });
        ctx.render();
      } catch (error) {
        ctx.toast(error.message);
        ctx.render();
      }
    });
  };
})();
