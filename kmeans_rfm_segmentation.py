
# ── Imports ────────────────────────────────────────────────────────────────────
import os
import warnings
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
from datetime import datetime

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import joblib

warnings.filterwarnings("ignore")

# ── Configuration ──────────────────────────────────────────────────────────────
DATA_PATH   = "data/online_retail_II.xlsx"
MODEL_DIR   = "models"
OUTPUT_DIR  = "outputs"
SHEET_NAME  = "Year 2010-2011"          # or "Year 2009-2010" — both work
K_RANGE     = range(2, 11)              # test K = 2 … 10 for elbow method
FINAL_K     = 4                         # final number of clusters
RANDOM_SEED = 42

# Cluster label mapping (assigned after inspecting centroid means)
# You can rename these after you see your own cluster analysis
CLUSTER_LABELS = {
    0: "At-Risk",
    1: "Lost",
    2: "Champions",
    3: "Loyal",
}

# Colour palette for plots (one colour per cluster)
CLUSTER_COLORS = {
    "Champions": "#10b981",
    "Loyal":     "#0ea5e9",
    "At-Risk":   "#f59e0b",
    "Lost":      "#f43f5e",
}

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Load & Clean Data
# ══════════════════════════════════════════════════════════════════════════════

def load_and_clean(path: str, sheet: str) -> pd.DataFrame:
    """Load the UCI Online Retail II xlsx and return a cleaned DataFrame."""
    print("\n[1/6] Loading dataset …")
    df = pd.read_excel(path, sheet_name=sheet, dtype={"Customer ID": str})
    print(f"      Raw rows: {len(df):,}  |  Columns: {list(df.columns)}")

    # ── Column normalisation (handle both 'CustomerID' and 'Customer ID')
    df.columns = df.columns.str.strip().str.replace(" ", "")
    rename_map = {
        "CustomerID": "CustomerID",
        "Invoice":    "InvoiceNo",
        "StockCode":  "StockCode",
        "Description":"Description",
        "Quantity":   "Quantity",
        "InvoiceDate":"InvoiceDate",
        "Price":      "UnitPrice",
        "Country":    "Country",
    }
    df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns},
              inplace=True)

    # ── Drop rows with missing CustomerID (can't segment without it)
    before = len(df)
    df.dropna(subset=["CustomerID"], inplace=True)
    print(f"      Dropped {before - len(df):,} rows with no CustomerID")

    # ── Remove cancelled invoices (InvoiceNo starts with 'C')
    cancelled = df["InvoiceNo"].astype(str).str.startswith("C")
    df = df[~cancelled]
    print(f"      Dropped {cancelled.sum():,} cancelled invoices")

    # ── Remove rows with negative / zero Quantity or UnitPrice
    df = df[(df["Quantity"] > 0) & (df["UnitPrice"] > 0)]

    # ── Compute TotalPrice per line
    df["TotalPrice"] = df["Quantity"] * df["UnitPrice"]

    # ── Parse InvoiceDate
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])

    print(f"      Clean rows: {len(df):,}")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Feature Engineering: RFM
# ══════════════════════════════════════════════════════════════════════════════

def build_rfm(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute RFM features for each customer.

    Recency   = days since customer's last purchase (lower = better)
    Frequency = number of distinct invoices (higher = better)
    Monetary  = total amount spent in GBP (higher = better)
    """
    print("\n[2/6] Engineering RFM features …")

    # Reference date = 1 day after the last recorded transaction
    reference_date = df["InvoiceDate"].max() + pd.Timedelta(days=1)
    print(f"      Reference date: {reference_date.date()}")

    rfm = (
        df.groupby("CustomerID")
        .agg(
            LastPurchase=("InvoiceDate", "max"),
            Frequency   =("InvoiceNo",   "nunique"),
            Monetary    =("TotalPrice",  "sum"),
        )
        .reset_index()
    )

    rfm["Recency"] = (reference_date - rfm["LastPurchase"]).dt.days
    rfm.drop(columns=["LastPurchase"], inplace=True)

    # Quick sanity check
    print(f"      Customers: {len(rfm):,}")
    print(rfm[["Recency", "Frequency", "Monetary"]].describe().round(2).to_string())

    return rfm


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Preprocessing: Scale RFM
# ══════════════════════════════════════════════════════════════════════════════

def preprocess(rfm: pd.DataFrame):
    """
    Standardise RFM values.
    K-Means is distance-based — without scaling, Monetary (£thousands)
    dominates Frequency (single digits) and Recency (days).
    """
    print("\n[3/6] Scaling RFM features with StandardScaler …")
    scaler = StandardScaler()
    X = scaler.fit_transform(rfm[["Recency", "Frequency", "Monetary"]])
    joblib.dump(scaler, f"{MODEL_DIR}/rfm_scaler.pkl")
    print(f"      Scaler saved → {MODEL_DIR}/rfm_scaler.pkl")
    return X, scaler


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Find Optimal K (Elbow + Silhouette)
# ══════════════════════════════════════════════════════════════════════════════

def find_optimal_k(X: np.ndarray) -> None:
    """
    Plot inertia (elbow curve) and silhouette scores for K = 2 … 10.
    Use the elbow point to pick FINAL_K in the configuration above.
    """
    print(f"\n[4/6] Running elbow + silhouette analysis for K = {K_RANGE.start}…{K_RANGE.stop - 1} …")

    inertias, sil_scores = [], []

    for k in K_RANGE:
        km = KMeans(n_clusters=k, random_state=RANDOM_SEED, n_init=10)
        labels = km.fit_predict(X)
        inertias.append(km.inertia_)
        sil_scores.append(silhouette_score(X, labels))
        print(f"      K={k}  inertia={km.inertia_:,.0f}  silhouette={sil_scores[-1]:.4f}")

    # ── Plot
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("Optimal K Selection — Elbow & Silhouette", fontsize=14, fontweight="bold", y=1.01)

    # Elbow
    ax = axes[0]
    ax.plot(list(K_RANGE), inertias, marker="o", color="#0ea5e9", linewidth=2, markersize=7)
    ax.axvline(FINAL_K, color="#f43f5e", linestyle="--", linewidth=1.5, label=f"Chosen K = {FINAL_K}")
    ax.set_title("Elbow Curve (Inertia)", fontsize=12)
    ax.set_xlabel("Number of Clusters (K)")
    ax.set_ylabel("Inertia (WCSS)")
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Silhouette
    ax = axes[1]
    ax.plot(list(K_RANGE), sil_scores, marker="s", color="#10b981", linewidth=2, markersize=7)
    ax.axvline(FINAL_K, color="#f43f5e", linestyle="--", linewidth=1.5, label=f"Chosen K = {FINAL_K}")
    ax.set_title("Silhouette Score", fontsize=12)
    ax.set_xlabel("Number of Clusters (K)")
    ax.set_ylabel("Silhouette Score (higher = better)")
    ax.legend()
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    save_path = f"{OUTPUT_DIR}/01_elbow_silhouette.png"
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Plot saved → {save_path}  ← Screenshot this for Review 2")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Train Final K-Means Model
# ══════════════════════════════════════════════════════════════════════════════

def train_kmeans(X: np.ndarray, rfm: pd.DataFrame) -> pd.DataFrame:
    """Train K-Means with FINAL_K, assign cluster labels, save model."""
    print(f"\n[5/6] Training K-Means with K = {FINAL_K} …")

    km = KMeans(n_clusters=FINAL_K, random_state=RANDOM_SEED, n_init=10, max_iter=300)
    rfm["Cluster"] = km.fit_predict(X)

    # ── Save model
    joblib.dump(km, f"{MODEL_DIR}/kmeans_customers.pkl")
    print(f"      Model saved → {MODEL_DIR}/kmeans_customers.pkl")

    # ── Cluster centroid summary (in original RFM scale)
    centroid_summary = rfm.groupby("Cluster")[["Recency", "Frequency", "Monetary"]].mean().round(2)
    print("\n      Cluster centroid means (original scale):")
    print(centroid_summary.to_string())

    # ── Map cluster numbers to descriptive labels
    # NOTE: The mapping in CLUSTER_LABELS at the top of this file may need
    #       adjusting based on YOUR centroid summary printed above.
    #       The rule: Champions = lowest Recency, highest Frequency & Monetary.
    rfm["Segment"] = rfm["Cluster"].map(CLUSTER_LABELS)

    # ── Segment size
    seg_counts = rfm["Segment"].value_counts()
    print("\n      Segment distribution:")
    print(seg_counts.to_string())

    return rfm, km


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Visualise & Save Results
# ══════════════════════════════════════════════════════════════════════════════

def visualise_and_save(rfm: pd.DataFrame, X: np.ndarray) -> None:
    """Generate 3 plots + export labelled customer CSV."""
    print("\n[6/6] Generating visualisations …")

    colors = [CLUSTER_COLORS.get(rfm.loc[rfm["Cluster"] == c, "Segment"].iloc[0], "#888")
              for c in sorted(rfm["Cluster"].unique())]

    # ── Plot 1: Segment distribution (bar chart) ─────────────────────────────
    fig, ax = plt.subplots(figsize=(8, 5))
    seg_counts = rfm["Segment"].value_counts()
    seg_counts_ordered = seg_counts.reindex(list(CLUSTER_LABELS.values()), fill_value=0)
    bar_colors = [CLUSTER_COLORS[s] for s in seg_counts_ordered.index]
    bars = ax.bar(seg_counts_ordered.index, seg_counts_ordered.values, color=bar_colors, edgecolor="white", linewidth=0.8)
    for bar, val in zip(bars, seg_counts_ordered.values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 20,
                f"{val:,}\n({val/len(rfm)*100:.1f}%)", ha="center", va="bottom", fontsize=10, fontweight="bold")
    ax.set_title("Customer Segments — K-Means RFM Clustering", fontsize=13, fontweight="bold")
    ax.set_xlabel("Segment")
    ax.set_ylabel("Number of Customers")
    ax.set_ylim(0, seg_counts_ordered.max() * 1.2)
    ax.grid(axis="y", alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/02_segment_distribution.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this for Review 2")

    # ── Plot 2: 3D RFM Scatter ────────────────────────────────────────────────
    fig = plt.figure(figsize=(10, 7))
    ax3d = fig.add_subplot(111, projection="3d")
    for seg, grp in rfm.groupby("Segment"):
        ax3d.scatter(grp["Recency"], grp["Frequency"], grp["Monetary"],
                     label=seg, color=CLUSTER_COLORS[seg], alpha=0.5, s=12)
    ax3d.set_xlabel("Recency (days)")
    ax3d.set_ylabel("Frequency (orders)")
    ax3d.set_zlabel("Monetary (£)")
    ax3d.set_title("3D RFM Scatter — Customer Segments", fontsize=13, fontweight="bold")
    ax3d.legend(title="Segment", loc="upper left")
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/03_rfm_3d_scatter.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this for Review 2")

    # ── Plot 3: RFM Box plots per segment ─────────────────────────────────────
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    fig.suptitle("RFM Distribution by Segment", fontsize=13, fontweight="bold")
    seg_order = list(CLUSTER_LABELS.values())
    palette = {s: CLUSTER_COLORS[s] for s in seg_order}

    for ax, metric in zip(axes, ["Recency", "Frequency", "Monetary"]):
        sns.boxplot(data=rfm, x="Segment", y=metric, order=seg_order,
                    palette=palette, ax=ax, linewidth=1.2, fliersize=3)
        ax.set_title(metric)
        ax.set_xlabel("")
        ax.tick_params(axis="x", rotation=15)
        ax.grid(axis="y", alpha=0.3)
        ax.spines[["top", "right"]].set_visible(False)
        if metric == "Monetary":
            ax.set_ylabel("Spend (£)")

    plt.tight_layout()
    p = f"{OUTPUT_DIR}/04_rfm_boxplots.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this for Review 2")

    # ── Plot 4: Segment heatmap (mean RFM normalised 0–1) ─────────────────────
    summary = rfm.groupby("Segment")[["Recency", "Frequency", "Monetary"]].mean()
    # Normalise each column 0–1 for visual comparison
    summary_norm = (summary - summary.min()) / (summary.max() - summary.min())
    # For Recency: lower is better, so invert
    summary_norm["Recency"] = 1 - summary_norm["Recency"]
    summary_norm.rename(columns={"Recency": "Recency (inv.)"}, inplace=True)

    fig, ax = plt.subplots(figsize=(7, 4))
    sns.heatmap(summary_norm.loc[seg_order], annot=True, fmt=".2f", cmap="YlGn",
                linewidths=0.5, ax=ax, cbar_kws={"label": "Score (0=low, 1=high)"})
    ax.set_title("Segment Heatmap — Normalised RFM Scores", fontsize=12, fontweight="bold")
    ax.set_ylabel("")
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/05_segment_heatmap.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this for Review 2")

    # ── Export labelled customers to CSV ──────────────────────────────────────
    out_csv = f"{OUTPUT_DIR}/customers_segmented.csv"
    rfm.to_csv(out_csv, index=False)
    print(f"\n      ✓ Segmented customer data exported → {out_csv}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Inference Helper (used by FastAPI later)
# ══════════════════════════════════════════════════════════════════════════════

def predict_segment(recency: int, frequency: int, monetary: float) -> dict:
    """
    Load saved scaler + model and predict segment for a new customer.
    Call this from your FastAPI endpoint:

        from kmeans_rfm_segmentation import predict_segment
        result = predict_segment(recency=30, frequency=5, monetary=320.0)
    """
    scaler = joblib.load(f"{MODEL_DIR}/rfm_scaler.pkl")
    model  = joblib.load(f"{MODEL_DIR}/kmeans_customers.pkl")

    X_new  = scaler.transform([[recency, frequency, monetary]])
    cluster_id = int(model.predict(X_new)[0])
    segment    = CLUSTER_LABELS.get(cluster_id, f"Cluster {cluster_id}")

    return {
        "cluster_id": cluster_id,
        "segment":    segment,
        "inputs": {
            "recency":   recency,
            "frequency": frequency,
            "monetary":  monetary,
        },
        "marketing_action": {
            "Champions": "Reward with loyalty points; show premium / new arrivals.",
            "Loyal":     "Upsell higher-margin products; ask for reviews.",
            "At-Risk":   "Send win-back email with personalised discount.",
            "Lost":      "Last-chance offer or survey to understand churn.",
        }.get(segment, "No action defined."),
    }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  K-Means RFM Customer Segmentation")
    print("  UCI Online Retail II Dataset")
    print("=" * 60)

    # 1. Load
    df = load_and_clean(DATA_PATH, SHEET_NAME)

    # 2. RFM
    rfm = build_rfm(df)

    # 3. Scale
    X, scaler = preprocess(rfm)

    # 4. Elbow + silhouette (choose your K here)
    find_optimal_k(X)

    # 5. Train
    rfm, km = train_kmeans(X, rfm)

    # 6. Visualise + export
    visualise_and_save(rfm, X)

    # 7. Quick inference demo
    print("\n── Inference demo ─────────────────────────────────────")
    demo = predict_segment(recency=10, frequency=12, monetary=850.0)
    print(f"   Input  → Recency={demo['inputs']['recency']}d, "
          f"Frequency={demo['inputs']['frequency']}, "
          f"Monetary=£{demo['inputs']['monetary']}")
    print(f"   Output → Segment: {demo['segment']}  (cluster {demo['cluster_id']})")
    print(f"   Action → {demo['marketing_action']}")

    print("\n✅ All done!")
    print(f"   Models   → {MODEL_DIR}/")
    print(f"   Plots    → {OUTPUT_DIR}/  (5 PNG files ready to screenshot)")
    print(f"   CSV      → {OUTPUT_DIR}/customers_segmented.csv")
    print("\nNOTE: If cluster labels look wrong, check the centroid summary")
    print("      printed above and update CLUSTER_LABELS in the config.")


if __name__ == "__main__":
    main()
