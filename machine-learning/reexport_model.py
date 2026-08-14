"""
Re-export the pricing model with opset_version=12 (IR version 7).
onnxruntime 1.17.1 supports up to IR version 9, so opset 12 is safe.
Run from: machine-learning/
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import onnx
import os

CSV_FILE = "turf_training_data.csv"
OUTPUT_ONNX = "../src/main/resources/ml_models/pricing_model.onnx"


def categorize_time(hour):
    return 0 if 0 <= hour <= 15 else 1


print("=== TurfChai Pricing Model Re-Export (opset 12) ===")

df = pd.read_csv(CSV_FILE)
# Strip leading/trailing whitespace from all column names
df.columns = [c.strip() for c in df.columns]

df['timeSlot'] = df['hour'].apply(categorize_time)

feature_columns = [
    'day', 'month', 'hour', 'weekend', 'publicHoliday',
    'daysBeforeBooking', 'weatherCondition', 'occupancyRate',
    'timeSlot'
]

X_train = df[feature_columns].values.astype(np.float32)
y_train = df['target_multiplier'].values.astype(np.float32)

print(f"Loaded {len(df)} rows. Columns: {df.columns.tolist()}")
print(f"Training model...")

model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
print(f"Training complete. R² = {model.score(X_train, y_train):.4f}")

initial_type = [('float_input', FloatTensorType([None, 9]))]

# Force opset_version=12 → maps to ONNX IR version 7 (safe for onnxruntime 1.17.1)
onnx_model = convert_sklearn(model, initial_types=initial_type, target_opset=12)

# Verify IR version before saving
ir_version = onnx_model.ir_version
print(f"ONNX IR version: {ir_version}  (must be <= 9 for onnxruntime 1.17.1)")
assert ir_version <= 9, f"IR version {ir_version} is too high! Adjust target_opset."

with open(OUTPUT_ONNX, "wb") as f:
    f.write(onnx_model.SerializeToString())

size_mb = os.path.getsize(OUTPUT_ONNX) / (1024 * 1024)
print(f"Saved to: {OUTPUT_ONNX}  ({size_mb:.1f} MB)")
print("Re-export complete. Restart Spring Boot to load the new model.")
