import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ProductTagListProps {
  message: string;
  onRemoveProduct: (productCode: string) => void;
  disabled?: boolean;
}

export const ProductTagList = ({ message, onRemoveProduct, disabled }: ProductTagListProps) => {
  // Parse message to separate text and product codes
  const parseMessage = (text: string) => {
    const parts: Array<{ type: 'text' | 'product', content: string }> = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before product code
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }
      
      // Add product code
      parts.push({
        type: 'product',
        content: match[1] // Content inside []
      });
      
      lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }
    
    return parts;
  };

  const parts = parseMessage(message);

  return (
    <div className="text-sm whitespace-pre-wrap break-words mt-1.5 flex flex-wrap items-center gap-1">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index} className="font-semibold">{part.content}</span>;
        } else {
          // Product badge with remove button
          return (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors group relative pr-6"
              onClick={() => !disabled && onRemoveProduct(part.content)}
            >
              {part.content}
              <X className="h-3 w-3 absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Badge>
          );
        }
      })}
    </div>
  );
};
