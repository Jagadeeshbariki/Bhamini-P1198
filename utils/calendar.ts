
export const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

export const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
};

export const generateCalendarDays = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = getFirstDayOfMonth(date);
    const daysInCurrentMonth = getDaysInMonth(date);
    
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const days: Date[] = [];
    
    // Days from previous month
    for (let i = firstDay; i > 0; i--) {
        days.push(new Date(year, month - 1, daysInPrevMonth - i + 1));
    }
    
    // Days from current month
    for (let i = 1; i <= daysInCurrentMonth; i++) {
        days.push(new Date(year, month, i));
    }
    
    // Days from next month
    const remainingCells = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingCells; i++) {
        days.push(new Date(year, month + 1, i));
    }

    return days;
};
