import arcpy
import os
from arcpy.sa import *

# Check out the Spatial Analyst extension
arcpy.CheckOutExtension("Spatial")

# Environment setup
arcpy.env.parallelProcessingFactor = "100%"
workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_towers\input.gdb"
scratch_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_towers\scratch.gdb"
output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_towers\output.gdb"

template_raster_name = "output_USGS_600m_resample_NYS_contourExtent_NAD83_20240227"
template_raster = os.path.join(workspace, template_raster_name)

arcpy.env.workspace = workspace
arcpy.env.scratchWorkspace = scratch_workspace
arcpy.env.overwriteOutput = True

# Load template raster properties
input_raster_properties = arcpy.Describe(template_raster)
arcpy.env.extent = input_raster_properties.extent
arcpy.env.cellSize = input_raster_properties.meanCellWidth

def validate_geometries(feature_class):
    problems = arcpy.CheckGeometry_management(feature_class)
    if int(arcpy.GetCount_management(problems)[0]) > 0:
        arcpy.RepairGeometry_management(feature_class, "DELETE_NULL")
    arcpy.AddMessage(f"Validated and repaired geometries for {feature_class}")
    

def convert_points_to_raster(feature_class, cell_size):
    output_raster_name = f"{os.path.splitext(os.path.basename(feature_class))[0]}_{int(cell_size)}m"
    output_raster_path = os.path.join(output_workspace, output_raster_name)
    
    # Use PointToRaster_conversion with correct parameters
    arcpy.PointToRaster_conversion(in_features=feature_class, 
                                   value_field="cellid",  # Ensure this field exists in your feature class
                                   out_rasterdataset=output_raster_path, 
                                   cell_assignment="MOST_FREQUENT", 
                                   priority_field="", 
                                   cellsize=cell_size)
    
    # Define projection of output raster to match the input raster's projection
    arcpy.DefineProjection_management(output_raster_path, input_raster_properties.spatialReference)
    
    arcpy.AddMessage(f"Converted {feature_class} to raster {output_raster_name} with cell size {cell_size}")
    return output_raster_path


def raster_to_centroids(input_raster, feature_class_name):
    centroid_feature_class = f"{feature_class_name}_centroids"
    output_feature_class_path = os.path.join(output_workspace, centroid_feature_class)
    arcpy.RasterToPoint_conversion(input_raster, output_feature_class_path, "VALUE")
    arcpy.AddMessage(f"Converted raster centroids back to points for {input_raster}")

def main(iterate_limit=2):
    feature_classes = arcpy.ListFeatureClasses()
    processed_count = 0

    for feature_class in feature_classes:
        full_feature_class_path = os.path.join(workspace, feature_class)  # Ensure the path is fully qualified
        
        if iterate_limit is not None and processed_count >= iterate_limit:
            break

        if not arcpy.Exists(full_feature_class_path):
            arcpy.AddWarning(f"Feature class {feature_class} does not exist. Skipping...")
            continue

        try:
            # validate_geometries(full_feature_class_path)
            output_raster = convert_points_to_raster(full_feature_class_path, arcpy.env.cellSize)  # Adjusted for the correct cellSize setting
            raster_to_centroids(output_raster, feature_class)
            processed_count += 1
        except Exception as e:
            arcpy.AddError(f"Error processing {feature_class}: {e}")
    feature_classes = arcpy.ListFeatureClasses()
    processed_count = 0

    for feature_class in feature_classes:
        if iterate_limit is not None and processed_count >= iterate_limit:
            break

        try:
            # validate_geometries(feature_class)
            output_raster = convert_points_to_raster(feature_class, arcpy.env.cellSize[0])  # Assuming cell size is uniform (width = height)
            raster_to_centroids(output_raster, feature_class)
            processed_count += 1
        except Exception as e:
            arcpy.AddError(f"Error processing {feature_class}: {e}")

if __name__ == "__main__":
    # Set iterate_limit to None for processing all feature classes, or to a specific number to limit the iteration
    main(iterate_limit=1)  

# Check the Spatial Analyst extension back in
arcpy.CheckInExtension("Spatial")
