import arcpy
import os
import sys  # Importing sys for system-specific parameters and functions

def set_environment_settings(raster_path):
    """Set arcpy environment settings based on a reference raster."""
    raster_desc = arcpy.Describe(raster_path)
    arcpy.env.outputCoordinateSystem = raster_desc.spatialReference
    arcpy.env.extent = raster_desc.extent
    arcpy.env.cellSize = raster_desc.meanCellWidth  # Assuming square cells
    arcpy.env.snapRaster = raster_path

def process_rasters(workspace, base_raster_path, output_workspace, clip_feature_class):
    """
    Loop through all rasters in the specified geodatabase, reprojecting them only if
    their CRS does not match the base raster's CRS and clipping them to a defined polygon feature class.
    """
    try:
        arcpy.env.workspace = workspace

        # Check if scratchWorkspace exists
        if not arcpy.Exists(arcpy.env.scratchWorkspace):
            raise Exception(f"Scratch workspace does not exist: {arcpy.env.scratchWorkspace}")

        # Set the environment settings based on the base raster
        set_environment_settings(base_raster_path)
        base_raster_crs = arcpy.Describe(base_raster_path).spatialReference

        # List all raster datasets in the geodatabase
        raster_list = arcpy.ListRasters()

        for raster in raster_list:
            raster_path = os.path.join(workspace, raster)
            raster_crs = arcpy.Describe(raster_path).spatialReference

            print(f"processing {raster}...")

            # Define the output raster name and path
            output_raster_name = os.path.splitext(raster)[0] + "_conformed"
            output_raster_path = os.path.join(output_workspace, output_raster_name)

            # Check if the CRS matches the base raster's CRS and reproject if necessary
            if raster_crs.name != base_raster_crs.name:
                # CRS does not match, reproject raster
                temp_raster_path = os.path.join(arcpy.env.scratchWorkspace, raster + "_temp")
                arcpy.management.ProjectRaster(in_raster=raster_path,
                                               out_raster=temp_raster_path,
                                               out_coor_system=base_raster_crs,
                                               resampling_type="NEAREST",
                                               cell_size=arcpy.env.cellSize)
                raster_path = temp_raster_path

            # Clip the raster to the polygon feature class
            arcpy.management.Clip(in_raster=raster_path,
                                  out_raster=output_raster_path,
                                  in_template_dataset=clip_feature_class,
                                  clipping_geometry="ClippingGeometry",
                                  maintain_clipping_extent="NO_MAINTAIN_EXTENT")
            print(f"processed raster: {output_raster_name}")

            # Cleanup the temporary raster if it was created
            if raster_crs.name != base_raster_crs.name:
                arcpy.Delete_management(temp_raster_path)
                print(f"Removed temporary file: {temp_raster_path}")
    except Exception as e:
        print(f"Error processing rasters: {e}")
        sys.exit(1)  # Exit the script with an error code

def main():
    try:
        arcpy.CheckOutExtension("Spatial")

        arcpy.env.overwriteOutput = True
        
        base_raster_path = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\input.gdb\output_USGS_750m_NYS_contourExtent_NAD83_20231126"
        workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\rasters.gdb"
        output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\aligned_rasters\aligned_rasters.gdb"
        clip_feature_class = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\input.gdb\output_USGS30m_rasterAOI_Union"
        arcpy.env.scratchWorkspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\aligned_rasters\scratch.gdb"
        
        process_rasters(workspace, base_raster_path, output_workspace, clip_feature_class)
        
    except Exception as e:
        print(f"Failed to complete raster processing: {e}")
    finally:
        arcpy.CheckInExtension("Spatial")

if __name__ == "__main__":
    main()
