import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodePreviewProps {
  value: string | null;
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

const BarcodePreview: React.FC<BarcodePreviewProps> = ({
  value,
  format = 'CODE128',
  width = 2,
  height = 100,
  displayValue = true,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format,
          width,
          height,
          displayValue,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (error) {
        console.error('JsBarcode error:', error);
      }
    }
  }, [value, format, width, height, displayValue]);

  return (
    <div className={`flex justify-center bg-white p-2 rounded overflow-hidden w-full ${className}`}>
      <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto' }}></svg>
    </div>
  );
};

export default BarcodePreview;
