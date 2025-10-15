export interface PrinterTemplate {
  name: string;
  content: string;
  settings: {
    width: number;
    fontSize: number;
    lineHeight: number;
    padding: number;
    align: 'left' | 'center' | 'right';
    fontFamily: string;
    orientation: 'portrait' | 'landscape';
  };
  lineStyles: Record<string, {
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
  }>;
  placeholderSizes?: Record<string, number>;
}

export const DEFAULT_TEMPLATE: PrinterTemplate = {
  name: "Mặc định XP-K200L",
  content: "#{{sessionIndex}} - {{phone}}\n{{customerName}}\n{{productCode}} - {{productName}}\n{{comment}}\n{{time}}",
  settings: {
    width: 480,
    fontSize: 22,
    lineHeight: 1.15,
    padding: 2,
    align: 'center',
    fontFamily: 'Tahoma, Arial, sans-serif',
    orientation: 'portrait'
  },
  lineStyles: {
    line1: { fontSize: 22, bold: true },
    line2: { fontSize: 22, bold: true },
    line3: { fontSize: 14, bold: true },
    line4: { fontSize: 22, bold: true, italic: true },
    line5: { fontSize: 9, bold: true }
  },
  placeholderSizes: {
    sessionIndex: 22,
    phone: 18,
    customerName: 22,
    productCode: 14,
    productName: 14,
    comment: 22,
    time: 9
  }
};

const STORAGE_KEY = 'printer_templates';
const ACTIVE_TEMPLATE_KEY = 'active_printer_template';

/**
 * Parse template content with placeholders and apply custom sizes
 */
export const parseTemplate = (
  template: string, 
  data: Record<string, string>,
  placeholderSizes?: Record<string, number>
): string => {
  let result = template;
  
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    
    // Wrap with span if custom size is defined
    if (placeholderSizes && placeholderSizes[key]) {
      const wrappedValue = `<span style="font-size: ${placeholderSizes[key]}pt">${value || ''}</span>`;
      result = result.replace(regex, wrappedValue);
    } else {
      result = result.replace(regex, value || '');
    }
  });
  
  return result;
};

/**
 * Apply data to template and return formatted content
 */
export const applyTemplate = (template: PrinterTemplate, data: Record<string, string>): string => {
  return parseTemplate(template.content, data, template.placeholderSizes);
};

/**
 * Validate template format
 */
export const validateTemplate = (template: PrinterTemplate): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!template.name?.trim()) {
    errors.push('Tên template không được để trống');
  }
  
  if (!template.content?.trim()) {
    errors.push('Nội dung template không được để trống');
  }
  
  if (template.settings.width < 384 || template.settings.width > 640) {
    errors.push('Chiều rộng phải từ 384px đến 640px (khuyến nghị 512px cho giấy 80mm)');
  }
  
  if (template.settings.fontSize < 20 || template.settings.fontSize > 40) {
    errors.push('Cỡ chữ phải từ 20pt đến 40pt');
  }
  
  if (template.settings.lineHeight < 1.0 || template.settings.lineHeight > 2.0) {
    errors.push('Khoảng cách dòng phải từ 1.0 đến 2.0');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Save template to localStorage
 */
export const saveTemplate = (template: PrinterTemplate): void => {
  try {
    const templates = loadAllTemplates();
    const existingIndex = templates.findIndex(t => t.name === template.name);
    
    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Error saving template:', error);
    throw new Error('Không thể lưu template');
  }
};

/**
 * Load all templates from localStorage
 */
export const loadAllTemplates = (): PrinterTemplate[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [DEFAULT_TEMPLATE];
    
    const templates = JSON.parse(stored) as PrinterTemplate[];
    return templates.length > 0 ? templates : [DEFAULT_TEMPLATE];
  } catch (error) {
    console.error('Error loading templates:', error);
    return [DEFAULT_TEMPLATE];
  }
};

/**
 * Delete template by name
 */
export const deleteTemplate = (name: string): void => {
  try {
    const templates = loadAllTemplates();
    const filtered = templates.filter(t => t.name !== name);
    
    if (filtered.length === 0) {
      // Always keep at least the default template
      localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_TEMPLATE]));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
    
    // If deleted template was active, switch to default
    const activeTemplate = getActiveTemplate();
    if (activeTemplate.name === name) {
      setActiveTemplate(DEFAULT_TEMPLATE.name);
    }
  } catch (error) {
    console.error('Error deleting template:', error);
    throw new Error('Không thể xóa template');
  }
};

/**
 * Set active template
 */
export const setActiveTemplate = (templateName: string): void => {
  localStorage.setItem(ACTIVE_TEMPLATE_KEY, templateName);
};

/**
 * Get active template
 */
export const getActiveTemplate = (): PrinterTemplate => {
  try {
    const activeTemplateName = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
    const templates = loadAllTemplates();
    
    if (activeTemplateName) {
      const template = templates.find(t => t.name === activeTemplateName);
      if (template) return template;
    }
    
    // Return default if no active template found
    return DEFAULT_TEMPLATE;
  } catch (error) {
    console.error('Error getting active template:', error);
    return DEFAULT_TEMPLATE;
  }
};

/**
 * Get sample data for preview
 */
export const getSampleData = (): Record<string, string> => {
  return {
    sessionIndex: '#123',
    phone: '0123456789',
    customerName: 'Nguyễn Văn A',
    productCode: 'SP001',
    productName: 'Áo thun nam cotton cao cấp',
    comment: 'Giao hàng nhanh nhé shop!',
    time: new Date().toLocaleString('vi-VN')
  };
};
