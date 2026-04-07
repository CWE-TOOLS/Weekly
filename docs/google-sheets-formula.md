=ARRAYFORMULA(
  LET(
    DataSheet, F2,
    start_row, 6,
    end_row, 200,
    start_col, "C",
    end_col, "KK",
    sort_priority_1, B1,
    sort_priority_2, B2,
    sort_priority_3, B3,

    data_range_ref, "'" & DataSheet & "'!" & start_col & start_row & ":" & end_col & end_row,
    project_name_ref, "'" & DataSheet & "'!B" & start_row & ":B" & end_row,
    dates_raw_ref, "'" & DataSheet & "'!" & start_col & "1:" & end_col & "1",
    departments_raw_ref, "'" & DataSheet & "'!" & start_col & "2:" & end_col & "2",

    data_range, INDIRECT(data_range_ref),
    project_name_col, INDIRECT(project_name_ref),
    dates_raw, INDIRECT(dates_raw_ref),
    departments_raw, INDIRECT(departments_raw_ref),

    num_rows, ROWS(data_range),
    row_indices, SEQUENCE(ROWS(project_name_col), 1, start_row, 1),
    num_cols, COLUMNS(data_range),

    filled_dates, SCAN(, dates_raw, LAMBDA(a, v, IF(v<>"", v, a))),
    filled_departments, SCAN(, departments_raw, LAMBDA(a, v, IF(v<>"", v, a))),
    mapped_departments, ARRAYFORMULA(SWITCH(filled_departments,
      "F", "Finish",
      "Crate", "Crating",
      "DM", "Demold",
      "FO", "Form Out",
      "Spec", "Special",
      filled_departments)),

    main_project_lookup, FILTER({row_indices, project_name_col}, ISEVEN(row_indices)),
    main_project_names, VLOOKUP(row_indices, main_project_lookup, 2, TRUE),

    project_grid, MAKEARRAY(num_rows, num_cols, LAMBDA(r,c, INDEX(main_project_names, r))),
    details_grid, MAKEARRAY(num_rows, num_cols, LAMBDA(r,c, IFERROR(INDEX(project_name_col, r + 1), ""))),
    dates_grid, MAKEARRAY(num_rows, num_cols, LAMBDA(r,c, INDEX(filled_dates, 1, c))),
    depts_grid, MAKEARRAY(num_rows, num_cols, LAMBDA(r,c, INDEX(mapped_departments, 1, c))),
    hours_grid, MAKEARRAY(num_rows, num_cols, LAMBDA(r,c, IFERROR(INDEX(data_range, r + 1, c), ""))),
    row_index_grid, MAKEARRAY(num_rows, num_cols, LAMBDA(r,c, r)),

    flat_projects, TOCOL(project_grid, 0, TRUE),
    flat_details, TOCOL(details_grid, 0, TRUE),
    flat_dates, TOCOL(dates_grid, 0, TRUE),
    flat_depts, TRIM(TOCOL(depts_grid, 0, TRUE)),
    flat_data, TRIM(TOCOL(data_range & "", 0, TRUE)),
    flat_hours, TOCOL(hours_grid & "", 0, TRUE),
    flat_row_indices, TOCOL(row_index_grid, 0, TRUE),

    load_depts, IF((flat_depts="Crating") * (LOWER(flat_data)="load"), "Load", flat_depts),
    modified_depts, IF(LOWER(flat_data)="final", "Final", load_depts),

    combined_data, {flat_projects, flat_details, flat_dates, modified_depts, flat_data, flat_hours},

    filtered_data, FILTER(combined_data, ISODD(flat_row_indices)),

    headers, {"Main Project", "Task Description", "Date", "Department", "Value", "Hours"},
    sort_col_1, MATCH(sort_priority_1, headers, 0),
    sort_col_2, MATCH(sort_priority_2, headers, 0),
    sort_col_3, MATCH(sort_priority_3, headers, 0),

    query_string, "SELECT * WHERE Col1 <> '' AND Col5 IS NOT NULL AND Col5 <> '' AND Col5 matches '.*[a-zA-Z].*' ORDER BY Col" & sort_col_1 & ", Col" & sort_col_2 & ", Col" & sort_col_3,

    QUERY(
      filtered_data,
      query_string & " LABEL Col1 'Main Project', Col2 'Task Description', Col3 'Date', Col4 'Department', Col5 'Value', Col6 'Hours'"
    )
  )
)
